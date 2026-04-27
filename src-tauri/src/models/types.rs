use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// A file/directory entry returned by scan_folder
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub extension: String,
    pub is_directory: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<ScannedFile>>,
}

/// Video metadata extracted by ffprobe
#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub size: u64,
}

/// A single effect instance applied to an export clip
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportEffect {
    #[serde(rename = "type")]
    pub effect_type: String,
    pub enabled: bool,
    pub params: HashMap<String, f64>,
}

/// A single clip descriptor used during export
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportClip {
    pub asset_path: String,
    #[serde(default = "default_export_media_type")]
    pub media_type: String,
    pub in_point: f64,
    pub out_point: f64,
    pub track_index: u32,
    pub start_time: f64,
    #[serde(default)]
    pub effects: Vec<ExportEffect>,
}

fn default_export_media_type() -> String {
    "video".to_string()
}

/// Parameters for the export command
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportParams {
    pub clips: Vec<ExportClip>,
    pub output_path: String,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub crf: u8,
}
