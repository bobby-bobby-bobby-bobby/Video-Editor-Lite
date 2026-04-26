use crate::models::types::{ScannedFile, VideoMetadata};
use std::path::Path;
use std::process::Command;
use tauri::command;

/// Recursively scans a folder and returns a tree of ScannedFile entries.
#[command]
pub fn scan_folder(folder_path: String) -> Result<Vec<ScannedFile>, String> {
    let path = Path::new(&folder_path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", folder_path));
    }
    scan_dir(path).map_err(|e| e.to_string())
}

fn scan_dir(dir: &Path) -> anyhow::Result<Vec<ScannedFile>> {
    let mut entries = Vec::new();

    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let meta = entry.metadata()?;
        let name = entry.file_name().to_string_lossy().to_string();

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        let extension = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_lowercase();

        if meta.is_dir() {
            let children = scan_dir(&path)?;
            entries.push(ScannedFile {
                name,
                path: path.to_string_lossy().to_string(),
                size: 0,
                extension: String::new(),
                is_directory: true,
                children: Some(children),
            });
        } else {
            entries.push(ScannedFile {
                name,
                path: path.to_string_lossy().to_string(),
                size: meta.len(),
                extension,
                is_directory: false,
                children: None,
            });
        }
    }

    // Sort: directories first, then by name
    entries.sort_by(|a, b| {
        b.is_directory
            .cmp(&a.is_directory)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

/// Extract video metadata using ffprobe.
#[command]
pub fn get_video_metadata(file_path: String) -> Result<VideoMetadata, String> {
    let ffprobe = find_ffprobe().ok_or("ffprobe not found. Please install FFmpeg.")?;

    let output = Command::new(&ffprobe)
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &file_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffprobe: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Failed to parse ffprobe output: {}", e))?;

    let mut meta = VideoMetadata::default();

    // Parse format section
    if let Some(fmt) = json.get("format") {
        if let Some(dur) = fmt.get("duration").and_then(|v| v.as_str()) {
            meta.duration = dur.parse().unwrap_or(0.0);
        }
        if let Some(size) = fmt.get("size").and_then(|v| v.as_str()) {
            meta.size = size.parse().unwrap_or(0);
        }
    }

    // Parse streams
    if let Some(streams) = json.get("streams").and_then(|v| v.as_array()) {
        for stream in streams {
            let codec_type = stream
                .get("codec_type")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if codec_type == "video" && meta.width == 0 {
                meta.width = stream.get("width").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                meta.height = stream.get("height").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
                meta.codec = stream
                    .get("codec_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // Parse "r_frame_rate" like "30000/1001" or "30/1"
                if let Some(fps_str) = stream.get("r_frame_rate").and_then(|v| v.as_str()) {
                    meta.fps = parse_rational(fps_str);
                }
            }
        }
    }

    Ok(meta)
}

/// Parse a rational number string like "30000/1001" → f64
fn parse_rational(s: &str) -> f64 {
    if let Some((num, den)) = s.split_once('/') {
        let n: f64 = num.trim().parse().unwrap_or(0.0);
        let d: f64 = den.trim().parse().unwrap_or(1.0);
        if d != 0.0 { n / d } else { 0.0 }
    } else {
        s.parse().unwrap_or(0.0)
    }
}

/// Try to find ffprobe in PATH or common installation directories.
pub fn find_ffprobe() -> Option<String> {
    // Try which/where first
    if let Ok(p) = which::which("ffprobe") {
        return Some(p.to_string_lossy().to_string());
    }
    // Common macOS Homebrew path
    let homebrew = "/opt/homebrew/bin/ffprobe";
    if Path::new(homebrew).exists() {
        return Some(homebrew.to_string());
    }
    // Linux common path
    let linux = "/usr/bin/ffprobe";
    if Path::new(linux).exists() {
        return Some(linux.to_string());
    }
    None
}

/// Try to find ffmpeg in PATH or common installation directories.
pub fn find_ffmpeg() -> Option<String> {
    if let Ok(p) = which::which("ffmpeg") {
        return Some(p.to_string_lossy().to_string());
    }
    let homebrew = "/opt/homebrew/bin/ffmpeg";
    if Path::new(homebrew).exists() {
        return Some(homebrew.to_string());
    }
    let linux = "/usr/bin/ffmpeg";
    if Path::new(linux).exists() {
        return Some(linux.to_string());
    }
    None
}
