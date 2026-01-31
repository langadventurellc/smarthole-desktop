interface StepLayoutProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function StepLayout({ title, description, children }: StepLayoutProps): React.ReactNode {
  return (
    <div className="step-layout">
      <div className="step-header">
        <h2 className="step-title">{title}</h2>
        {description && <p className="step-description">{description}</p>}
      </div>
      <div className="step-content">{children}</div>
    </div>
  );
}
