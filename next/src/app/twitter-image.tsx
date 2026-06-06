import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '굳띵즈 로스터스 - good things, simply roasted.';

export default function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FBF8F3',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px',
          fontFamily: 'sans-serif',
        }}
      >
        <svg viewBox="0 0 48 48" width="160" height="160" xmlns="http://www.w3.org/2000/svg">
          <path
            fill="#1e1b16"
            d="M30.1,2.7v2.3c-1.6-1.4-4.2-3-8-3.1-6,0-14.5,3.3-14.5,14.8s1.3,15.6,14.5,15.8,6.5-1.4,8-2.8v3.1c0,1.8-.9,4.8-6.2,4.8s-5.7-2.4-5.7-3.1h-8.8c0,1.1,2.7,11.3,14.5,11.3s15.5-8,15.5-13V2.8s-9.3,0-9.3,0h0ZM23.3,25c-3.8,0-6.9-3.5-6.8-7.8s3-7.6,6.8-7.6,7,3.5,7,7.8-2.8,7.6-7,7.6Z"
          />
        </svg>
        <div
          style={{
            marginTop: '40px',
            fontSize: '64px',
            fontWeight: 600,
            color: '#1e1b16',
            letterSpacing: '-0.02em',
            display: 'flex',
          }}
        >
          Good Things Roasters
        </div>
        <div
          style={{
            marginTop: '20px',
            fontSize: '28px',
            fontWeight: 400,
            color: '#1e1b16',
            opacity: 0.7,
            letterSpacing: '0.02em',
            display: 'flex',
          }}
        >
          good things, simply roasted.
        </div>
      </div>
    ),
    { ...size },
  );
}
