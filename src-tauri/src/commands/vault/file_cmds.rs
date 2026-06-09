use crate::vault;
use std::path::{Path, PathBuf};

use super::boundary::{with_requested_root, with_validated_path};

fn with_note_path<T>(
    path: &Path,
    vault_path: Option<&Path>,
    action: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let raw_path = path.to_string_lossy();
    let raw_vault_path = vault_path.map(|value| value.to_string_lossy());
    with_validated_path(&raw_path, raw_vault_path.as_deref(), |validated_path| {
        action(Path::new(validated_path))
    })
}

fn with_external_file_path<T>(
    path: &Path,
    vault_path: Option<&Path>,
    action: impl FnOnce(&Path) -> Result<T, String>,
) -> Result<T, String> {
    with_note_path(path, vault_path, action)
}

fn with_requested_root_path<T>(
    vault_path: &Path,
    action: impl FnOnce(&str) -> Result<T, String>,
) -> Result<T, String> {
    let raw_vault_path = vault_path.to_string_lossy();
    with_requested_root(raw_vault_path.as_ref(), action)
}

fn sync_image_asset_scope(
    app_handle: &tauri::AppHandle,
    requested_root: &str,
) -> Result<(), String> {
    #[cfg(desktop)]
    crate::sync_vault_asset_scope(app_handle, Path::new(requested_root))?;
    #[cfg(not(desktop))]
    let _ = requested_root;
    #[cfg(not(desktop))]
    let _ = app_handle;
    Ok(())
}

fn with_image_asset_scope(
    app_handle: &tauri::AppHandle,
    vault_path: &Path,
    action: impl FnOnce(&str) -> Result<String, String>,
) -> Result<String, String> {
    with_requested_root_path(vault_path, |requested_root| {
        let saved_path = action(requested_root)?;
        sync_image_asset_scope(app_handle, requested_root)?;
        Ok(saved_path)
    })
}

#[tauri::command]
pub fn open_vault_file_external(
    app_handle: tauri::AppHandle,
    path: PathBuf,
    vault_path: Option<PathBuf>,
) -> Result<(), String> {
    with_external_file_path(path.as_path(), vault_path.as_deref(), |validated_path| {
        open_path_with_default_app(&app_handle, validated_path)
    })
}

fn open_path_with_default_app(app_handle: &tauri::AppHandle, path: &Path) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;

    app_handle
        .opener()
        .open_path(path.to_string_lossy().into_owned(), None::<String>)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_note_content(path: PathBuf, vault_path: Option<PathBuf>) -> Result<String, String> {
    with_note_path(
        path.as_path(),
        vault_path.as_deref(),
        vault::get_note_content,
    )
}

#[tauri::command]
pub fn validate_note_content(
    path: PathBuf,
    content: String,
    vault_path: Option<PathBuf>,
) -> Result<bool, String> {
    with_note_path(path.as_path(), vault_path.as_deref(), |validated_path| {
        vault::note_content_matches(validated_path, &content)
    })
}

#[tauri::command]
pub fn save_image(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
    filename: String,
    data: String,
) -> Result<String, String> {
    with_image_asset_scope(&app_handle, vault_path.as_path(), |requested_root| {
        vault::save_image(requested_root, &filename, &data)
    })
}

#[tauri::command]
pub fn copy_image_to_vault(
    app_handle: tauri::AppHandle,
    vault_path: PathBuf,
    source_path: PathBuf,
) -> Result<String, String> {
    with_image_asset_scope(&app_handle, vault_path.as_path(), |requested_root| {
        vault::copy_image_to_vault(requested_root, source_path.to_string_lossy().as_ref())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn vault_root(dir: &TempDir) -> PathBuf {
        dir.path().to_path_buf()
    }

    fn note_path(dir: &TempDir, name: &str) -> PathBuf {
        dir.path().join(name)
    }

    #[test]
    fn commands_reject_paths_outside_requested_vault() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_note = outside.path().join("outside.md");
        fs::write(&outside_note, "# Outside\n").unwrap();

        let error = get_note_content(outside_note, Some(vault.path().to_path_buf())).unwrap_err();
        assert!(error.contains("Path must stay inside the active vault"));
    }

    #[test]
    fn external_file_paths_accept_files_inside_requested_vault() {
        let dir = TempDir::new().unwrap();
        let root = vault_root(&dir);
        let attachment = note_path(&dir, "attachments/photo.png");
        fs::create_dir_all(attachment.parent().unwrap()).unwrap();
        fs::write(&attachment, "image-bytes").unwrap();

        let validated = with_external_file_path(
            attachment.as_path(),
            Some(root.as_path()),
            |validated_path| Ok(validated_path.to_path_buf()),
        )
        .unwrap();

        assert_eq!(validated, attachment);
    }

    #[test]
    fn external_file_paths_reject_files_outside_requested_vault() {
        let vault = TempDir::new().unwrap();
        let outside = TempDir::new().unwrap();
        let outside_file = outside.path().join("photo.png");
        fs::write(&outside_file, "image-bytes").unwrap();

        let error = with_external_file_path(
            outside_file.as_path(),
            Some(vault.path()),
            |validated_path| Ok(validated_path.to_path_buf()),
        )
        .unwrap_err();

        assert!(error.contains("Path must stay inside the active vault"));
    }

    #[test]
    fn validate_note_content_compares_against_disk() {
        let dir = TempDir::new().unwrap();
        let root = vault_root(&dir);
        let note = note_path(&dir, "note.md");
        fs::write(&note, "# Fresh\n").unwrap();

        assert!(
            validate_note_content(note.clone(), "# Fresh\n".to_string(), Some(root.clone()),)
                .unwrap()
        );
        assert!(!validate_note_content(note, "# Stale\n".to_string(), Some(root)).unwrap());
    }
}
