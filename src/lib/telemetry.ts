// 埋点已从 MarkKnife 移除。trackEvent 保留为空操作,兼容现有调用点(SingleEditorView 等)。
export function trackEvent(name: string, properties?: Record<string, string | number>): void {
  // 埋点已移除,此处仅占位以兼容调用点
  void name
  void properties
}
