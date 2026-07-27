import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from 'frontend';
import { Button } from 'frontend';
import { Input } from 'frontend';
import { Label } from 'frontend';

export function CreateTeam() {
  return (
    <Dialog defaultOpen>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a team</DialogTitle>
          <DialogDescription>Register a new team in the Spring Cup 2026 group stage.</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="t-name">Team name</Label>
            <Input id="t-name" defaultValue="HC Sparta Praha" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label htmlFor="t-group">Group</Label>
            <Input id="t-group" defaultValue="Group A" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button>Add team</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
