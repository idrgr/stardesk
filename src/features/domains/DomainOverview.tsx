import type { ModuleConfig } from '@/domain/entities'
import { GrowthOverview } from './GrowthOverview'
import { CareerOverview } from './CareerOverview'
import { HobbiesOverview } from './HobbiesOverview'
import { FitnessOverview } from './FitnessOverview'

export function DomainOverview({ module }: { module: ModuleConfig }) {
  switch (module.definitionKey) {
    case 'growth':
      return <GrowthOverview module={module} />
    case 'career':
      return <CareerOverview module={module} />
    case 'hobbies':
      return <HobbiesOverview module={module} />
    case 'fitness':
      return <FitnessOverview module={module} />
    default:
      return null
  }
}
