/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export function AccountAvatar({
  photo,
  initials,
  className,
  textClassName = "",
}: {
  photo?: string;
  initials: string;
  className: string;
  textClassName?: string;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[var(--sage)] text-[var(--on-sage)] ${className}`}
    >
      {photo ? (
        <img src={photo} alt="" className="h-full w-full object-cover" />
      ) : (
        <span
          className={`grid h-full w-full place-items-center font-serif font-bold italic ${textClassName}`}
        >
          {initials}
        </span>
      )}
    </div>
  );
}
