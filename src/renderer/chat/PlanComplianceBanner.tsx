type PlanComplianceBannerProps = {
  rules: string[];
  onDismiss: () => void;
  onManagePlan: () => void;
};

export function PlanComplianceBanner({ rules, onDismiss, onManagePlan }: PlanComplianceBannerProps) {
  if (rules.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-app-border bg-app-surface px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-app-text">Plan compliance</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-app-muted">
            {rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/10"
            onClick={onManagePlan}
          >
            Manage plan
          </button>
          <button
            type="button"
            aria-label="Dismiss plan compliance notice"
            className="rounded-lg px-2.5 py-1.5 text-xs text-app-muted transition-colors hover:bg-app-chat-hover hover:text-app-text"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
