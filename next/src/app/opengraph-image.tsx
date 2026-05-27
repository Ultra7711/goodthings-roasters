import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = '굳띵즈 로스터스 - good things, simply roasted.';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1E1B16',
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
            fill="#FBF8F3"
            d="M30.3724,2.6471l.023,2.3342c-1.6239-1.4291-4.2604-2.9812-8.0601-2.9812-6.0225,0-14.3353,3.4509-14.3353,14.9255,0,3.3647.6786,15.6157,13.9112,15.6157,4.5622,0,7.2227-1.4513,8.7275-2.8421l.0306,3.1105s-.4772,4.9081-6.1285,4.9081c-4.3261,0-5.6833-2.9333-5.6833-2.9333h-8.8217s2.1206,11.2157,14.5898,11.2157,15.3744-10.7651,15.3744-13.1904l-.2969-30.1625h-9.3307ZM23.815,25.0353c-3.8181,0-6.9132-3.4378-6.9132-7.6785s3.0951-7.6785,6.9132-7.6785,6.9132,3.4378,6.9132,7.6785-3.0951,7.6785-6.9132,7.6785Z"
          />
        </svg>
        <div
          style={{
            marginTop: '40px',
            fontSize: '64px',
            fontWeight: 600,
            color: '#FBF8F3',
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
            color: '#FBF8F3',
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
