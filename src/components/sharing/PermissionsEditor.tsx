'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export interface Permissions {
  dashboard: boolean | { view: boolean };
  transactions: { view: boolean; create: boolean; edit: boolean; delete: boolean };
  budgets: { view: boolean; edit: boolean };
  goals: boolean | { view: boolean; edit: boolean };
  debts: boolean | { view: boolean; edit: boolean };
  investments: boolean | { view: boolean; edit: boolean };
  assets: boolean | { view: boolean; edit: boolean };
  reports: boolean | { view: boolean };
  settings: boolean;
  integrations: boolean;
}

interface PermissionsEditorProps {
  permissions: Permissions;
  onChange: (permissions: Permissions) => void;
  disabled?: boolean;
}

const PERMISSION_LABELS: Record<string, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard', icon: 'bx-home' },
  transactions: { label: 'Transações', icon: 'bx-arrow-right-left' },
  budgets: { label: 'Orçamentos', icon: 'bx-pie-chart-alt-2' },
  goals: { label: 'Objetivos', icon: 'bx-target-lock' },
  debts: { label: 'Dívidas', icon: 'bx-credit-card' },
  investments: { label: 'Investimentos', icon: 'bx-line-chart' },
  assets: { label: 'Patrimônio', icon: 'bx-building-house' },
  reports: { label: 'Relatórios', icon: 'bx-bar-chart-alt-2' },
  settings: { label: 'Configurações', icon: 'bx-cog' },
  integrations: { label: 'Integrações', icon: 'bx-plug' },
};

const ACTION_LABELS: Record<string, string> = {
  view: 'Visualizar',
  create: 'Criar',
  edit: 'Editar',
  delete: 'Excluir',
};

export default function PermissionsEditor({
  permissions,
  onChange,
  disabled = false,
}: PermissionsEditorProps) {
  const [expanded, setExpanded] = useState<string[]>(['transactions']);

  const handleSimpleToggle = (key: keyof Permissions, value: boolean) => {
    onChange({
      ...permissions,
      [key]: value,
    });
  };

  const handleComplexToggle = (
    key: keyof Permissions,
    action: string,
    value: boolean
  ) => {
    const current = permissions[key];
    if (typeof current === 'boolean') {
      // Convert to object
      const newValue: Record<string, boolean> = { view: current, edit: current };
      if (key === 'transactions') {
        (newValue as any).create = current;
        (newValue as any).delete = current;
      }
      newValue[action] = value;
      onChange({
        ...permissions,
        [key]: newValue,
      });
    } else if (typeof current === 'object') {
      onChange({
        ...permissions,
        [key]: {
          ...current,
          [action]: value,
        },
      });
    }
  };

  const isEnabled = (key: keyof Permissions, action?: string): boolean => {
    const perm = permissions[key];
    if (typeof perm === 'boolean') return perm;
    if (typeof perm === 'object' && action) {
      return (perm as Record<string, boolean>)[action] ?? false;
    }
    return false;
  };

  const renderSimplePermission = (key: keyof Permissions) => {
    const info = PERMISSION_LABELS[key];
    const enabled = isEnabled(key);

    return (
      <div
        key={key}
        className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <i className={`bx ${info.icon} text-lg text-muted-foreground`}></i>
          <Label className="cursor-pointer">{info.label}</Label>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(value) => handleSimpleToggle(key, value)}
          disabled={disabled}
        />
      </div>
    );
  };

  const renderComplexPermission = (key: keyof Permissions, actions: string[]) => {
    const info = PERMISSION_LABELS[key];

    return (
      <AccordionItem key={key} value={key} className="border-none">
        <AccordionTrigger className="py-3 px-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-3">
            <i className={`bx ${info.icon} text-lg text-muted-foreground`}></i>
            <span>{info.label}</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-muted/20 rounded-b-lg px-4 pb-3">
          <div className="space-y-2 pt-2">
            {actions.map((action) => (
              <div
                key={action}
                className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/30 transition-colors"
              >
                <Label className="cursor-pointer text-sm text-muted-foreground">
                  {ACTION_LABELS[action] || action}
                </Label>
                <Switch
                  checked={isEnabled(key, action)}
                  onCheckedChange={(value) => handleComplexToggle(key, action, value)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <div className="space-y-2">
      <Accordion
        type="multiple"
        value={expanded}
        onValueChange={setExpanded}
        className="space-y-2"
      >
        {/* Dashboard - Simple */}
        {renderSimplePermission('dashboard')}

        {/* Transactions - Complex */}
        {renderComplexPermission('transactions', ['view', 'create', 'edit', 'delete'])}

        {/* Budgets - Complex */}
        {renderComplexPermission('budgets', ['view', 'edit'])}

        {/* Goals - Complex */}
        {renderComplexPermission('goals', ['view', 'edit'])}

        {/* Debts - Complex */}
        {renderComplexPermission('debts', ['view', 'edit'])}

        {/* Investments - Complex */}
        {renderComplexPermission('investments', ['view', 'edit'])}

        {/* Assets - Complex */}
        {renderComplexPermission('assets', ['view', 'edit'])}

        {/* Reports - Simple */}
        {renderSimplePermission('reports')}

        {/* Settings - Simple (usually disabled) */}
        {renderSimplePermission('settings')}

        {/* Integrations - Simple */}
        {renderSimplePermission('integrations')}
      </Accordion>
    </div>
  );
}
