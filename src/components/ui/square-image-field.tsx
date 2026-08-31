import { SQUARE_CARD_HINT } from "@/lib/upload";
import { Field, Input } from "@/components/ui/field";

type Props = {
  label?: string;
  htmlFor: string;
  fileName: string;
  removeName?: string;
  currentUrl?: string | null;
  readOnly?: boolean;
  showRemove?: boolean;
  hint?: string;
  previewClassName?: string;
};

export function SquareImageField({
  label = "Photo",
  htmlFor,
  fileName,
  removeName = "remove_photo",
  currentUrl,
  readOnly,
  showRemove = Boolean(currentUrl),
  hint = SQUARE_CARD_HINT,
  previewClassName = "h-20 w-20 rounded-sm border border-gold-700/25 bg-parchment-100 object-cover p-0.5",
}: Props) {
  return (
    <div className="grid gap-2">
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="" className={previewClassName} />
      ) : null}
      <Field label={label} htmlFor={htmlFor} hint={hint}>
        <Input
          id={htmlFor}
          name={fileName}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={readOnly}
        />
      </Field>
      {showRemove && currentUrl ? (
        <label className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted">
          <input type="checkbox" name={removeName} disabled={readOnly} className="h-4 w-4 shrink-0" />
          Remove current photo
        </label>
      ) : null}
    </div>
  );
}
