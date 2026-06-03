export const DEFAULT_TOP_HEADER_USER_NAME = "John Doe";

type TopHeaderProps = {
  userName?: string;
};

export function TopHeader({ userName = DEFAULT_TOP_HEADER_USER_NAME }: TopHeaderProps) {
  const avatarLetter = userName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="flex h-[57px] items-center justify-end rounded-t-[var(--radius-x-large)] bg-[#ffffff] px-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-[#21262a]">{userName}</span>
        <div
          aria-label={`${userName} avatar`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2ca8df] text-xs font-semibold text-white"
        >
          {avatarLetter}
        </div>
      </div>
    </header>
  );
}
