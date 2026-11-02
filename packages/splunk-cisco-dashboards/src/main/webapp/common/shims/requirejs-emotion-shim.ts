/**
 * Also bundled into the small default dashboard.js extension. The C3 header
 * can execute before the much larger React page finishes downloading.
 */
import isPropValid from '@emotion/is-prop-valid';
import { installRequireJsEmotionCompat } from './requirejsEmotionCompat';

if (typeof window !== 'undefined') {
    installRequireJsEmotionCompat(window, isPropValid);
}
