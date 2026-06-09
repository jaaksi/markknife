use crate::vault;
use std::path::Path;
use std::sync::Mutex;

/// 读取单个 Markdown 文件（绝对路径）。
#[tauri::command]
pub fn read_markdown_file(path: String) -> Result<String, String> {
    vault::get_note_content(Path::new(&path))
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
