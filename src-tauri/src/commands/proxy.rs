use crate::commands::media::find_ffmpeg;
use std::path::PathBuf;
use std::process::Command;
use tauri::{command, AppHandle};

/// Generate a lower-resolution proxy file for the given video asset.
/// Returns the path to the generated proxy file.
#[command]
pub async fn generate_proxy(
    app_handle: AppHandle,
    asset_id: String,
    input_path: String,
) -> Result<String, String> {
    let ffmpeg = find_ffmpeg().ok_or("ffmpeg not found. Please install FFmpeg.")?;

    // Determine proxy output directory inside app data
    let app_dir = app_handle
        .path_resolver()
        .app_data_dir()
        .ok_or("Cannot resolve app data dir")?;
    let proxy_dir = app_dir.join("proxies");
    std::fs::create_dir_all(&proxy_dir)
        .map_err(|e| format!("Cannot create proxy dir: {}", e))?;

    // Proxy file path: proxies/<asset_id>.mp4
    let proxy_path: PathBuf = proxy_dir.join(format!("{}.mp4", asset_id));

    if proxy_path.exists() {
        // Already generated
        return Ok(proxy_path.to_string_lossy().to_string());
    }

    // FFmpeg command:
    // -i <input> -vf scale=640:-2 -c:v libx264 -crf 28 -preset ultrafast
    //   -c:a aac -b:a 128k -movflags +faststart <output>
    let output = Command::new(&ffmpeg)
        .args([
            "-y",                   // overwrite output
            "-i", &input_path,
            "-vf", "scale=640:-2", // scale to 640px wide, keep aspect ratio
            "-c:v", "libx264",
            "-crf", "28",
            "-preset", "ultrafast",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            proxy_path.to_str().unwrap_or_default(),
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("ffmpeg proxy generation failed: {}", stderr));
    }

    Ok(proxy_path.to_string_lossy().to_string())
}
