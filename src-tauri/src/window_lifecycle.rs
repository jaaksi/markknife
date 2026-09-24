//! 窗口生命周期:macOS 上「点关闭 = 隐藏窗口」,应用常驻不退出。
//!
//! 点红灯 / ⌘W 关闭主窗口时只把窗口隐藏(webview 不销毁),进程继续留在 Dock 里;
//! 下次从访达双击 .md、点 Dock 图标、点菜单「历史记录」时直接把窗口显示出来,
//! 省掉整个冷启动(进程 + webview + 前端初始化)。⌘Q(应用菜单退出)不受影响。
//!
//! 只在 macOS 生效:Windows / Linux 没有「一个窗口都没有还继续运行」的常态,本应用又没有
//! 托盘图标,窗口一旦隐藏用户无从唤回,那两个平台仍保持「关闭即退出」。

use tauri::{AppHandle, Manager, RunEvent};

use crate::window_state::MAIN_WINDOW_LABEL;

/// 显示并聚焦主窗口(可能处于隐藏 / 最小化态)。
pub(crate) fn show_main_window(app_handle: &AppHandle) {
    let _ = revive_main_window(app_handle);
}

/// 唤回主窗口并返回它的 label;主窗口不存在时返回 None。
///
/// 给「要把事件定向投给某个窗口、但此刻没有聚焦窗口」的场景用(见 app_menu 的历史记录点击)。
pub(crate) fn revive_main_window(app_handle: &AppHandle) -> Option<String> {
    let window = app_handle.get_webview_window(MAIN_WINDOW_LABEL)?;
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    Some(window.label().to_string())
}

/// 拦截主窗口关闭并处理 Dock 图标点击。
///
/// 必须在 `window_state::handle_run_event` **之后**调用:后者也监听 `CloseRequested`
/// 并借此把窗口位置落盘,顺序反了会先隐藏再读取窗口几何。
#[cfg(target_os = "macos")]
pub(crate) fn handle_run_event(app_handle: &AppHandle, event: &RunEvent) {
    match event {
        // 关闭请求拦下来:只隐藏,不销毁。
        RunEvent::WindowEvent {
            label,
            event: tauri::WindowEvent::CloseRequested { api, .. },
            ..
        } if label == MAIN_WINDOW_LABEL => {
            api.prevent_close();
            hide_main_window(app_handle);
        }
        // 点 Dock 图标(applicationShouldHandleReopen):没有可见窗口时把主窗口唤回。
        RunEvent::Reopen {
            has_visible_windows,
            ..
        } if !has_visible_windows => show_main_window(app_handle),
        _ => {}
    }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn handle_run_event(_app_handle: &AppHandle, _event: &RunEvent) {}

#[cfg(target_os = "macos")]
fn hide_main_window(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window(MAIN_WINDOW_LABEL) {
        let _ = window.hide();
    }
}
