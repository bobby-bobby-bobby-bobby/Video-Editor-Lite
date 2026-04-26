use std::fs;
use std::path::Path;
use tauri::command;

/// Save the project JSON string to the given file path.
#[command]
pub fn save_project(project_json: String, file_path: String) -> Result<(), String> {
    let path = Path::new(&file_path);

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Cannot create directory: {}", e))?;
    }

    fs::write(path, &project_json).map_err(|e| format!("Failed to write project file: {}", e))?;

    Ok(())
}

/// Load and return the project JSON string from the given file path.
#[command]
pub fn load_project(file_path: String) -> Result<String, String> {
    let path = Path::new(&file_path);

    if !path.exists() {
        return Err(format!("Project file not found: {}", file_path));
    }

    let contents = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read project file: {}", e))?;

    // Basic validation: must be valid JSON
    let _: serde_json::Value = serde_json::from_str(&contents)
        .map_err(|e| format!("Invalid project file (not valid JSON): {}", e))?;

    Ok(contents)
}
