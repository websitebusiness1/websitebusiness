import { ChangeEvent } from 'react';
import { ALLOWED_IMAGE_TYPES, publicImageUrl } from '@/lib/storage';
import { Spinner } from './ui';

interface Props { label: string; path: string | null; uploading: boolean; onPick: (f: File) => void; wide?: boolean; disabled?: boolean }

export default function ImageSlot({ label, path, uploading, onPick, wide, disabled }: Props) {
  const url = publicImageUrl(path);
  const off = uploading || disabled;
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) onPick(file);
  };
  return (
    <div>
      <p className="label">{label}</p>
      <div className={`mb-3 flex items-center justify-center overflow-hidden rounded border border-sand-200 bg-sand-50 ${wide ? 'aspect-[3/1]' : 'h-32 w-32'}`}>
        {url ? <img src={url} alt={`${label} preview`} className="h-full w-full object-cover" /> : <span className="px-3 text-center text-xs text-sand-500">No {label.toLowerCase()} yet</span>}
      </div>
      <label className={`btn-outline cursor-pointer ${off ? 'pointer-events-none opacity-50' : ''}`}>
        {uploading && <Spinner />} {url ? 'Replace' : 'Upload'} {label.toLowerCase()}
        <input type="file" className="sr-only" accept={Object.keys(ALLOWED_IMAGE_TYPES).join(',')} onChange={onChange} disabled={off} />
      </label>
    </div>
  );
}
