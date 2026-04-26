use crate::commands::media::find_ffmpeg;
use crate::models::types::ExportParams;
use std::io::Write;
use std::path::Path;
use std::process::Command;
use tauri::command;

/// Export the timeline to a video file using FFmpeg.
///
/// Strategy:
///   1. For each clip, generate a trimmed segment using ffmpeg -ss / -to.
///   2. Concatenate all segments using the FFmpeg concat demuxer.
///   3. Final pass encodes to the target format.
#[command]
pub async fn export_video(params: ExportParams) -> Result<(), String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg not found. Please install FFmpeg.")?;

    if params.clips.is_empty() {
        return Err("No clips to export".to_string());
    }

    // Create a temporary directory for intermediate segment files
    let tmp_dir = std::env::temp_dir().join(format!("vel_export_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&tmp_dir)
        .map_err(|e| format!("Cannot create tmp dir: {}", e))?;

    let mut segment_paths: Vec<String> = Vec::new();

    // Sort clips by start time for sequencing
    let mut clips = params.clips.clone();
    clips.sort_by(|a, b| a.start_time.partial_cmp(&b.start_time).unwrap());

    // Step 1: Extract each clip as a lossless intermediate
    for (i, clip) in clips.iter().enumerate() {
        let duration = clip.out_point - clip.in_point;
        if duration <= 0.0 {
            continue;
        }

        let seg_path = tmp_dir.join(format!("seg_{:04}.mp4", i));
        let seg_str = seg_path.to_string_lossy().to_string();

        let output = Command::new(&ffmpeg)
            .args([
                "-y",
                "-ss", &format!("{:.6}", clip.in_point),
                "-t", &format!("{:.6}", duration),
                "-i", &clip.asset_path,
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", &params.crf.to_string(),
                "-vf", &format!("scale={}:{}", params.width, params.height),
                "-c:a", "aac",
                "-b:a", "192k",
                &seg_str,
            ])
            .output()
            .map_err(|e| format!("ffmpeg segment extraction failed: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // Clean up temp dir on failure
            std::fs::remove_dir_all(&tmp_dir).ok();
            return Err(format!("Segment {} failed: {}", i, stderr));
        }

        segment_paths.push(seg_str);
    }

    if segment_paths.is_empty() {
        std::fs::remove_dir_all(&tmp_dir).ok();
        return Err("No valid segments produced".to_string());
    }

    // Step 2: Write concat list file
    let concat_file = tmp_dir.join("concat.txt");
    {
        let mut f = std::fs::File::create(&concat_file)
            .map_err(|e| format!("Cannot create concat file: {}", e))?;
        for seg in &segment_paths {
            // Escape single quotes in paths
            let escaped = seg.replace('\'', "'\\''");
            writeln!(f, "file '{}'", escaped)
                .map_err(|e| format!("Write error: {}", e))?;
        }
    }

    // Step 3: Concatenate and produce final output
    let output = Command::new(&ffmpeg)
        .args([
            "-y",
            "-f", "concat",
            "-safe", "0",
            "-i", concat_file.to_str().unwrap_or_default(),
            "-c", "copy",
            &params.output_path,
        ])
        .output()
        .map_err(|e| format!("ffmpeg concat failed: {}", e))?;

    // Clean up temp directory
    std::fs::remove_dir_all(&tmp_dir).ok();

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Export failed: {}", stderr));
    }

    Ok(())
}
