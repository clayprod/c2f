'use client';

import { useState } from 'react';
import AdminFilters from './AdminFilters';
import AggregatedDataTable from './AggregatedDataTable';

export default function AdminFiltersWrapper() {
  const [filters, setFilters] = useState<any>(null);

  return (
    <>
      <AdminFilters onFiltersChange={setFilters} />
      <AggregatedDataTable filters={filters} />
    </>
  );
}

