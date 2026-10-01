<script lang="ts">
  // Routes a module id to its screen.
  import TasksPage from './tasks/TasksPage.svelte';
  import GoalsPage from './goals/GoalsPage.svelte';
  import HabitsPage from './habits/HabitsPage.svelte';
  import CalendarPage from './calendar/CalendarPage.svelte';
  import NotesPage from './notes/NotesPage.svelte';
  import WellnessPage from './wellness/WellnessPage.svelte';
  import FinancePage from './finance/FinancePage.svelte';
  import ProjectsPage from './projects/ProjectsPage.svelte';
  import StudyHub from './study/StudyHub.svelte';
  import type { ModuleId } from '../../lib/db/schema';

  let { module }: { module: ModuleId } = $props();
</script>

{#if module === 'tasks'}<TasksPage />
{:else if module === 'goals'}<GoalsPage />
{:else if module === 'habits'}<HabitsPage />
{:else if module === 'calendar'}<CalendarPage />
{:else if module === 'notes'}<NotesPage />
{:else if module === 'wellness'}<WellnessPage />
{:else if module === 'work'}<ProjectsPage kind="work" />
{:else if module === 'study'}<StudyHub />
{:else}<FinancePage />{/if}
