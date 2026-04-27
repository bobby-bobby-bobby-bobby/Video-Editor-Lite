use crate::commands::media::{find_ffmpeg, find_ffprobe};
use crate::models::types::{ExportEffect, ExportParams};
use std::io::Write;
use std::path::Path;
use std::process::Command;
use tauri::command;

fn param(effect: &ExportEffect, key: &str, default: f64) -> f64 {
    effect.params.get(key).copied().unwrap_or(default)
}

fn atempo_chain(speed: f64) -> String {
    if speed <= 0.0 {
        return "atempo=1".to_string();
    }

    let mut filters = Vec::new();
    let mut remaining = speed;

    while remaining > 2.0 {
        filters.push("atempo=2".to_string());
        remaining /= 2.0;
    }
    while remaining < 0.5 {
        filters.push("atempo=0.5".to_string());
        remaining *= 2.0;
    }
    filters.push(format!("atempo={:.6}", remaining));
    filters.join(",")
}

fn probe_streams(ffprobe: &str, asset_path: &str) -> Result<(bool, bool), String> {
    let output = Command::new(ffprobe)
        .args([
            "-v",
            "error",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            asset_path,
        ])
        .output()
        .map_err(|e| format!("ffprobe failed for '{}': {}", asset_path, e))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe failed for '{}': {}",
            asset_path,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut has_video = false;
    let mut has_audio = false;
    for line in stdout.lines().map(str::trim) {
        if line == "video" {
            has_video = true;
        } else if line == "audio" {
            has_audio = true;
        }
    }
    Ok((has_video, has_audio))
}

fn build_effect_filters(effects: &[ExportEffect], width: u32, height: u32) -> (String, String) {
    let mut video_filters: Vec<String> = Vec::new();
    let mut audio_filters: Vec<String> = Vec::new();
    let mut brightness = 0.0;
    let mut contrast_delta = 0.0;

    for effect in effects {
        if !effect.enabled {
            continue;
        }

        match effect.effect_type.as_str() {
            "brightness" => {
                brightness += param(effect, "value", 0.0);
            }
            "contrast" => {
                contrast_delta += param(effect, "value", 0.0);
            }
            "blur" => {
                let sigma = param(effect, "radius", 0.0).clamp(0.0, 100.0);
                if sigma > 0.0 {
                    video_filters.push(format!("gblur=sigma={:.6}", sigma));
                }
            }
            "speed" => {
                let speed = param(effect, "multiplier", 1.0).clamp(0.1, 4.0);
                if (speed - 1.0).abs() > f64::EPSILON {
                    video_filters.push(format!("setpts=PTS/{:.6}", speed));
                    audio_filters.push(atempo_chain(speed));
                }
            }
            "greenscreen" => {
                let r = param(effect, "keyR", 0.0).clamp(0.0, 255.0) as u8;
                let g = param(effect, "keyG", 255.0).clamp(0.0, 255.0) as u8;
                let b = param(effect, "keyB", 0.0).clamp(0.0, 255.0) as u8;
                let threshold = param(effect, "threshold", 0.2).clamp(0.0, 1.0);
                let softness = param(effect, "softness", 0.08).clamp(0.0, 1.0);
                video_filters.push(format!(
                    "colorkey=0x{:02x}{:02x}{:02x}:{:.6}:{:.6}",
                    r, g, b, threshold, softness
                ));
            }
            _ => {}
        }
    }

    let safe_brightness = brightness.clamp(-1.0, 1.0);
    let safe_contrast = (1.0 + contrast_delta).clamp(0.0, 2.0);
    if safe_brightness.abs() > f64::EPSILON || (safe_contrast - 1.0).abs() > f64::EPSILON {
        video_filters.insert(
            0,
            format!(
                "eq=brightness={:.6}:contrast={:.6}",
                safe_brightness, safe_contrast
            ),
        );
    }
    video_filters.push(format!("scale={}:{}", width, height));
    (video_filters.join(","), audio_filters.join(","))
}

/// Export timeline to output using source files and FFmpeg effects/scaling pipeline.
#[command]
pub async fn export_video(params: ExportParams) -> Result<(), String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg not found. Please install FFmpeg.")?;
    let ffprobe = find_ffprobe().ok_or("ffprobe not found. Please install FFmpeg.")?;

    if params.clips.is_empty() {
        return Err("No clips to export".to_string());
    }

    let tmp_dir = std::env::temp_dir().join(format!("vel_export_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir).map_err(|e| format!("Cannot create tmp dir: {}", e))?;

    let mut segment_paths: Vec<String> = Vec::new();

    let mut clips = params.clips.clone();
    clips.sort_by(
        |a, b| match (a.start_time.is_nan(), b.start_time.is_nan()) {
            (true, true) => std::cmp::Ordering::Equal,
            (true, false) => std::cmp::Ordering::Greater,
            (false, true) => std::cmp::Ordering::Less,
            (false, false) => a
                .start_time
                .partial_cmp(&b.start_time)
                .unwrap_or(std::cmp::Ordering::Equal),
        },
    );

    for (i, clip) in clips.iter().enumerate() {
        if !Path::new(&clip.asset_path).exists() {
            std::fs::remove_dir_all(&tmp_dir).ok();
            return Err(format!("Missing source file: {}", clip.asset_path));
        }

        let duration = clip.out_point - clip.in_point;
        if duration <= 0.0 {
            continue;
        }

        let seg_path = tmp_dir.join(format!("seg_{:04}.mp4", i));
        let seg_str = seg_path.to_string_lossy().to_string();
        let (video_filter, audio_filter) =
            build_effect_filters(&clip.effects, params.width, params.height);

        let mut args = vec!["-y".to_string()];
        let mut video_map = "0:v:0".to_string();
        let mut audio_map: Option<String> = None;

        match clip.media_type.as_str() {
            "image" => {
                args.extend_from_slice(&[
                    "-loop".to_string(),
                    "1".to_string(),
                    "-t".to_string(),
                    format!("{:.6}", duration),
                    "-i".to_string(),
                    clip.asset_path.clone(),
                ]);
                if !video_filter.is_empty() {
                    args.push("-vf".to_string());
                    args.push(video_filter);
                }
                args.extend_from_slice(&[
                    "-f".to_string(),
                    "lavfi".to_string(),
                    "-t".to_string(),
                    format!("{:.6}", duration),
                    "-i".to_string(),
                    "anullsrc=channel_layout=stereo:sample_rate=44100".to_string(),
                ]);
                audio_map = Some("1:a:0".to_string());
            }
            "audio" => {
                let (_, has_audio) = probe_streams(&ffprobe, &clip.asset_path)?;
                if !has_audio {
                    std::fs::remove_dir_all(&tmp_dir).ok();
                    return Err(format!(
                        "Audio clip has no audio stream: {}",
                        clip.asset_path
                    ));
                }
                args.extend_from_slice(&[
                    "-f".to_string(),
                    "lavfi".to_string(),
                    "-t".to_string(),
                    format!("{:.6}", duration),
                    "-i".to_string(),
                    format!(
                        "color=c=black:s={}x{}:r={}",
                        params.width, params.height, params.fps
                    ),
                    "-ss".to_string(),
                    format!("{:.6}", clip.in_point),
                    "-t".to_string(),
                    format!("{:.6}", duration),
                    "-i".to_string(),
                    clip.asset_path.clone(),
                ]);
                video_map = "0:v:0".to_string();
                audio_map = Some("1:a:0".to_string());
                if !audio_filter.is_empty() {
                    args.push("-af".to_string());
                    args.push(audio_filter);
                }
            }
            _ => {
                let (has_video, has_audio) = probe_streams(&ffprobe, &clip.asset_path)?;
                if has_video {
                    args.extend_from_slice(&[
                        "-ss".to_string(),
                        format!("{:.6}", clip.in_point),
                        "-t".to_string(),
                        format!("{:.6}", duration),
                        "-i".to_string(),
                        clip.asset_path.clone(),
                    ]);
                    if !video_filter.is_empty() {
                        args.push("-vf".to_string());
                        args.push(video_filter);
                    }
                } else {
                    args.extend_from_slice(&[
                        "-f".to_string(),
                        "lavfi".to_string(),
                        "-t".to_string(),
                        format!("{:.6}", duration),
                        "-i".to_string(),
                        format!(
                            "color=c=black:s={}x{}:r={}",
                            params.width, params.height, params.fps
                        ),
                        "-ss".to_string(),
                        format!("{:.6}", clip.in_point),
                        "-t".to_string(),
                        format!("{:.6}", duration),
                        "-i".to_string(),
                        clip.asset_path.clone(),
                    ]);
                    video_map = "0:v:0".to_string();
                }

                if has_audio {
                    let audio_input = if has_video { 0 } else { 1 };
                    audio_map = Some(format!("{audio_input}:a:0"));
                    if !audio_filter.is_empty() {
                        args.push("-af".to_string());
                        args.push(audio_filter);
                    }
                } else {
                    args.extend_from_slice(&[
                        "-f".to_string(),
                        "lavfi".to_string(),
                        "-t".to_string(),
                        format!("{:.6}", duration),
                        "-i".to_string(),
                        "anullsrc=channel_layout=stereo:sample_rate=44100".to_string(),
                    ]);
                    let silent_input = if has_video { 1 } else { 2 };
                    audio_map = Some(format!("{silent_input}:a:0"));
                }
            }
        }

        args.push("-map".to_string());
        args.push(video_map);
        if let Some(audio_map) = audio_map {
            args.push("-map".to_string());
            args.push(audio_map);
        }
        args.extend_from_slice(&[
            "-r".to_string(),
            format!("{:.6}", params.fps),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "fast".to_string(),
            "-crf".to_string(),
            params.crf.to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            "-pix_fmt".to_string(),
            "yuv420p".to_string(),
            "-shortest".to_string(),
            seg_str.clone(),
        ]);

        let output = Command::new(&ffmpeg)
            .args(args)
            .output()
            .map_err(|e| format!("ffmpeg segment extraction failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            std::fs::remove_dir_all(&tmp_dir).ok();
            return Err(format!("Segment {} failed: {}", i, stderr));
        }

        segment_paths.push(seg_str);
    }

    if segment_paths.is_empty() {
        std::fs::remove_dir_all(&tmp_dir).ok();
        return Err("No valid segments produced".to_string());
    }

    let concat_file = tmp_dir.join("concat.txt");
    {
        let mut f = std::fs::File::create(&concat_file)
            .map_err(|e| format!("Cannot create concat file: {}", e))?;
        for seg in &segment_paths {
            let escaped = seg.replace('\'', "'\\''");
            writeln!(f, "file '{}'", escaped).map_err(|e| format!("Write error: {}", e))?;
        }
    }

    let concat_args = vec![
        "-y".to_string(),
        "-f".to_string(),
        "concat".to_string(),
        "-safe".to_string(),
        "0".to_string(),
        "-i".to_string(),
        concat_file.to_str().unwrap_or_default().to_string(),
        "-r".to_string(),
        format!("{:.6}", params.fps),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "fast".to_string(),
        "-crf".to_string(),
        params.crf.to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "192k".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        params.output_path.clone(),
    ];
    let output = Command::new(&ffmpeg)
        .args(concat_args)
        .output()
        .map_err(|e| format!("ffmpeg concat failed: {}", e))?;

    std::fs::remove_dir_all(&tmp_dir).ok();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Export failed: {}", stderr));
    }

    Ok(())
}
