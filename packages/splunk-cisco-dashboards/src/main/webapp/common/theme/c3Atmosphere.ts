import type { CSSProperties } from 'react';
import { appStaticAssetUrl } from '@/common/lib/appStaticAssetUrl';

/** Borderless Cisco Cloud Control atmosphere shared by every dashboard shell. */
export const C3_ATMOSPHERE_ASSET_URL = appStaticAssetUrl('c3-atmosphere.svg');

export const C3_ATMOSPHERE_BACKGROUND_STYLE: CSSProperties = {
    backgroundColor: '#0b1118',
    backgroundImage: `url("${C3_ATMOSPHERE_ASSET_URL}")`,
    backgroundPosition: 'center top',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
};
