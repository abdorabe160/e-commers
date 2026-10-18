// Project banner shown in the card preview window.
export function ProjectCover({ src }: { src: string }) {
  return (
    <div className="absolute inset-0">
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent" />
    </div>
  );
}
