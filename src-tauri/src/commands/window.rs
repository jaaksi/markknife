use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

/// 拆出窗口（label `note-{n}`）待打开的文件路径表：新窗口前端启动后按自身 label 领取。
/// 复用「pending 待打开文件」的思路,但按窗口 label 索引,支持同时存在多个拆出窗口。
#[derive(Default)]
pub struct DetachedOpenPaths(pub Mutex<HashMap<String, String>>);

/// 拆出窗口 label 的自增计数器,保证唯一。
#[derive(Default)]
pub struct DetachedWindowCounter(pub AtomicU64);

/// 在一个新的独立窗口中打开指定文件（标签右键「在新窗口打开」）。
///
/// 由菜单显式触发,直接创建新窗口：label 用 `note-*` 前缀以继承 capability 权限,
/// 复刻主窗口外观(对照 tauri.conf.json),位置相对当前窗口偏移以免完全重叠。
#[tauri::command]
pub fn detach_tab_to_window(
    window: WebviewWindow,
    app: AppHandle,
    paths: tauri::State<'_, DetachedOpenPaths>,
    counter: tauri::State<'_, DetachedWindowCounter>,
    path: String,
) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let pos = window.outer_position().map_err(|e| e.to_string())?;

    let n = counter.0.fetch_add(1, Ordering::Relaxed);
    let label = format!("note-{n}");
    if let Ok(mut guard) = paths.0.lock() {
        guard.insert(label.clone(), path);
    }

    // 新窗口位置：当前窗口左上角（逻辑像素）+ 偏移,避免与原窗口完全重叠。
    let new_x = pos.x as f64 / scale + 40.0;
    let new_y = pos.y as f64 / scale + 40.0;

    // URL 带 detached 标记:前端据此在文件载入前显示加载态(而非起始页)。
    // 窗口立即可见以保证点击即时反馈,用与主窗口一致的背景色避免前端加载期白闪。
    #[cfg_attr(not(target_os = "macos"), allow(unused_mut))]
    let mut builder = WebviewWindowBuilder::new(
        &app,
        &label,
        WebviewUrl::App("index.html?detached=1".into()),
    )
    .title("MarkKnife")
    .inner_size(1400.0, 900.0)
    .min_inner_size(480.0, 400.0)
    .resizable(true)
    .background_color(tauri::window::Color(247, 246, 243, 255))
    .position(new_x, new_y);

    // 复刻主窗口的 macOS 标题栏外观（隐藏标题 + 覆盖式 + 红绿灯位置）。
    #[cfg(target_os = "macos")]
    {
        builder = builder
            .title_bar_style(tauri::TitleBarStyle::Overlay)
            .hidden_title(true)
            .traffic_light_position(tauri::LogicalPosition::new(18.0, 24.0));
    }

    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

/// 拆出窗口前端启动时领取并清空本窗口（按 label）待打开的文件路径;非拆出窗口返回 None。
#[tauri::command]
pub fn take_detached_open_path(
    window: WebviewWindow,
    paths: tauri::State<'_, DetachedOpenPaths>,
) -> Option<String> {
    let label = window.label().to_string();
    paths
        .0
        .lock()
        .ok()
        .and_then(|mut guard| guard.remove(&label))
}
