import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectGroup, SelectLabel,
} from 'frontend';

export function SportType() {
  return (
    <Select defaultValue="hockey">
      <SelectTrigger style={{ width: 240 }}>
        <SelectValue placeholder="Select a sport" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Sport</SelectLabel>
          <SelectItem value="hockey">Ice Hockey</SelectItem>
          <SelectItem value="football">Football</SelectItem>
          <SelectItem value="basketball">Basketball</SelectItem>
          <SelectItem value="floorball">Floorball</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

export function Placeholder() {
  return (
    <Select>
      <SelectTrigger style={{ width: 240 }}>
        <SelectValue placeholder="Select season status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="draft">Draft</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="completed">Completed</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function Disabled() {
  return (
    <Select defaultValue="active" disabled>
      <SelectTrigger style={{ width: 240 }}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">Active</SelectItem>
      </SelectContent>
    </Select>
  );
}
