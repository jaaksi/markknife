import { trackEvent } from './telemetry'

export function trackInlineImageLightboxOpened(): void {
  trackEvent('inline_image_lightbox_opened')
}
