import Svg, { Circle, Ellipse, Path, G } from 'react-native-svg';
import { useTheme } from '@/lib/theme-context';

type Mood = 'happy' | 'wave' | 'sleepy';

type Props = {
  size?: number;
  mood?: Mood;
};

export default function Owl({ size = 160, mood = 'happy' }: Props) {
  const { isDark } = useTheme();
  const sleeping = mood === 'sleepy';

  const BODY = isDark ? '#3D3D48' : '#222222';
  const BODY_LIGHT = isDark ? '#4F4F5C' : '#3A3A3A';
  const EYE_BG = isDark ? '#F2EFE8' : '#FFFFFF';
  const EYE_RING = isDark ? '#0E0E12' : '#222222';
  const PUPIL = isDark ? '#0E0E12' : '#222222';
  const BEAK = '#FF9F1C';
  const BEAK_DARK = '#E08300';
  const FEET = '#FF9F1C';
  const CHEEK = '#FF6B6B';

  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <G>
        <Path d="M82 196 Q82 204 90 204 L100 204 Q104 198 100 192 Z" fill={FEET} />
        <Path d="M138 196 Q138 204 130 204 L120 204 Q116 198 120 192 Z" fill={FEET} />
      </G>

      <Ellipse cx="110" cy="184" rx="56" ry="14" fill={BODY} />

      <Path
        d="M110 38
           C 60 38 38 80 38 122
           C 38 168 70 192 110 192
           C 150 192 182 168 182 122
           C 182 80 160 38 110 38 Z"
        fill={BODY}
      />

      <Path
        d="M110 88
           C 82 88 70 110 70 138
           C 70 168 90 182 110 182
           C 130 182 150 168 150 138
           C 150 110 138 88 110 88 Z"
        fill={BODY_LIGHT}
      />

      <Path d="M40 110 Q26 130 36 162 Q52 168 60 152 Q56 130 56 110 Q48 102 40 110 Z" fill={BODY} />
      <Path d="M180 110 Q194 130 184 162 Q168 168 160 152 Q164 130 164 110 Q172 102 180 110 Z" fill={BODY} />

      <Circle cx="82" cy="92" r="26" fill={EYE_BG} stroke={EYE_RING} strokeWidth="4" />
      <Circle cx="138" cy="92" r="26" fill={EYE_BG} stroke={EYE_RING} strokeWidth="4" />

      {!sleeping ? (
        <G>
          <Circle cx="84" cy="94" r="11" fill={PUPIL} />
          <Circle cx="140" cy="94" r="11" fill={PUPIL} />
          <Circle cx="88" cy="90" r="3.5" fill={EYE_BG} />
          <Circle cx="144" cy="90" r="3.5" fill={EYE_BG} />
        </G>
      ) : (
        <G>
          <Path d="M70 96 Q82 104 96 96" stroke={PUPIL} strokeWidth="4.5" fill="none" strokeLinecap="round" />
          <Path d="M126 96 Q138 104 152 96" stroke={PUPIL} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </G>
      )}

      {mood !== 'sleepy' && (
        <G opacity="0.55">
          <Ellipse cx="62" cy="118" rx="8" ry="5" fill={CHEEK} />
          <Ellipse cx="158" cy="118" rx="8" ry="5" fill={CHEEK} />
        </G>
      )}

      <Path
        d="M110 116 L102 124 L110 134 L118 124 Z"
        fill={BEAK}
        stroke={BEAK_DARK}
        strokeWidth="1.5"
      />

      {mood === 'wave' && (
        <G>
          <Path d="M178 80 Q200 70 200 50 Q190 56 184 64 Q176 72 178 80 Z" fill={BODY} />
        </G>
      )}
    </Svg>
  );
}
