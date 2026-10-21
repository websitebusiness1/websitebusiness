import MembersPanel from '@/components/MembersPanel';
import { PageHeader } from '@/components/ui';

export default function OwnerMembers() {
  return (
    <div>
      <PageHeader title="Members" description="Who can manage each store. Only you can add or remove access." />
      <MembersPanel />
    </div>
  );
}
