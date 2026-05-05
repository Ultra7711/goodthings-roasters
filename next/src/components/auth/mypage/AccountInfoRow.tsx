'use client';

type Props = {
  name: string;
  email: string;
};

export default function AccountInfoRow({ name, email }: Props) {
  return (
    <>
      <div className="mp-info-row">
        <span className="mp-info-label">이름</span>
        <span className="mp-info-value">{name}</span>
      </div>
      <div className="mp-info-row">
        <span className="mp-info-label">이메일</span>
        <span className="mp-info-value">{email}</span>
      </div>
    </>
  );
}
