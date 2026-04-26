use crate::commands::media::find_ffmpeg;
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

fn build_effect_filters(effects: &[ExportEffect], width: u32, height: u32) -> (String, String) {
    let mut video_filters: Vec<String> = Vec::new();
    let mut audio_filters: Vec<String> = Vec::new();

    for effect in effects {
        if !effect.enabled {
            continue;
        }

        match effect.effect_type.as_str() {
            "brightness" => {
                let v = param(effect, "value", 0.0).clamp(-1.0, 1.0);
                video_filters.push(format!("eq=brightness={:.6}", v));
            }
            "contrast" => {
                let v = (1.0 + param(effect, "value", 0.0)).clamp(0.0, 2.0);
                video_filters.push(format!("eq=contrast={:.6}", v));
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

    video_filters.push(format!("scale={}:{}", width, height));
    (video_filters.join(","), audio_filters.join(","))
}

/// Export timeline to output using source files and FFmpeg effects/scaling pipeline.
#[command]
pub async fn export_video(params: ExportParams) -> Result<(), String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg not found. Please install FFmpeg.")?;

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

        let mut args = vec![
            "-y".to_string(),
            "-ss".to_string(),
            format!("{:.6}", clip.in_point),
            "-t".to_string(),
            format!("{:.6}", duration),
            "-i".to_string(),
            clip.asset_path.clone(),
            "-vf".to_string(),
            video_filter,
        ];
        if !audio_filter.is_empty() {
            args.push("-af".to_string());
            args.push(audio_filter);
        }
        args.extend_from_slice(&[
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

    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_file.to_str().unwrap_or_default(),
            "-c",
            "copy",
            &params.output_path,
        ])
        .output()
        .map_err(|e| format!("ffmpeg concat failed: {}", e))?;

    std::fs::remove_dir_all(&tmp_dir).ok();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Export failed: {}", stderr));
    }

    Ok(())
}
