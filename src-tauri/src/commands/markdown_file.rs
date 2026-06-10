use crate::vault;
use std::path::Path;
use std::sync::Mutex;

/// 读取单个 Markdown 文件（绝对路径）。同时把文件所在目录加入 asset 协议白名单——
/// 文档内相对路径图片会被前端转成 asset URL,目录不在白名单内 webview 会拒绝加载。
#[tauri::command]
pub fn read_markdown_file(app_handle: tauri::AppHandle, path: String) -> Result<String, String> {
    let note_path = Path::new(&path);
    let content = vault::get_note_content(note_path)?;
    #[cfg(desktop)]
    if let Some(parent) = note_path.parent() {
        // 授权失败只影响图片显示,不阻断打开文件。
        if let Err(error) = crate::sync_vault_asset_scope(&app_handle, parent) {
            log::warn!("为 {} 授权图片资源目录失败: {error}", parent.display());
        }
    }
    #[cfg(not(desktop))]
    let _ = app_handle;
    Ok(content)
}

/// 写入单个 Markdown 文件（绝对路径）。父目录不存在时创建，带写入重试。
#[tauri::command]
pub fn write_markdown_file(path: String, content: String) -> Result<(), String> {
    vault::save_note_content(&path, &content)
}

/// 暂存「由系统打开方式 / 双击 / 命令行」传入、但前端尚未就绪时的待打开文件路径。
#[derive(Default)]
pub struct PendingOpenFile(pub Mutex<Option<String>>);

/// 领取并清空待打开文件路径（前端挂载后调用一次，用于冷启动经由文件关联打开的场景）。
#[tauri::command]
pub fn take_pending_open_file(state: tauri::State<'_, PendingOpenFile>) -> Option<String> {
    state.0.lock().ok().and_then(|mut guard| guard.take())
}

/// 在系统文件管理器（macOS 访达 / Windows 资源管理器）中定位并选中该文件。
#[tauri::command]
pub fn reveal_path_in_dir(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .reveal_item_in_dir(path)
        .map_err(|e| e.to_string())
}

/// 重命名文件（仅改同目录下的文件名）。`new_name` 为新文件名（不含路径分隔符）；
/// 未带扩展名时沿用 `.md`。返回重命名后的绝对路径。目标已存在或非法时报错。
#[tauri::command]
pub fn rename_markdown_file(old_path: String, new_name: String) -> Result<String, String> {
    let trimmed = new_name.trim();
    if trimmed.is_empty() {
        return Err("文件名不能为空".into());
    }
    if trimmed.contains('/') || trimmed.contains('\\') {
        return Err("文件名不能包含路径分隔符".into());
    }

    let old = Path::new(&old_path);
    let parent = old
        .parent()
        .ok_or_else(|| "无法确定文件所在目录".to_string())?;
    // 未带扩展名则沿用 .md。
    let file_name = if Path::new(trimmed).extension().is_some() {
        trimmed.to_string()
    } else {
        format!("{trimmed}.md")
    };
    let new_path = parent.join(&file_name);

    if new_path == old {
        return Ok(old_path);
    }
    if new_path.exists() {
        return Err(format!("已存在同名文件：{file_name}"));
    }
    std::fs::rename(old, &new_path).map_err(|e| e.to_string())?;
    Ok(new_path.to_string_lossy().into_owned())
}
