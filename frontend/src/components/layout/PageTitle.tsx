interface PageTitleProps {
  title: string;
  description?: string;
}

export function PageTitle({ title, description }: PageTitleProps) {
  return (
    <div className="mb-6">
      <h1 className="font-heading text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
      {description ? <p className="mt-2 max-w-3xl text-sm text-slate-600">{description}</p> : null}
    </div>
  );
}
