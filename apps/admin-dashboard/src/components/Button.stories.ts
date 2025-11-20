/**
 * Button Component Stories for Visual Regression Testing
 *
 * Tests all button variants across different states and viewports
 */

import type { Meta, StoryObj } from '@storybook/vue3'
// Import your actual Button component
// import Button from './Button.vue'

// Mock Button component for demonstration
const Button = {
  name: 'Button',
  props: {
    variant: {
      type: String,
      default: 'primary',
    },
    size: {
      type: String,
      default: 'medium',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  },
  template: `
    <button
      :class="[
        'btn',
        'btn-' + variant,
        'btn-' + size,
        { 'btn-disabled': disabled, 'btn-loading': loading }
      ]"
      :disabled="disabled"
    >
      <span v-if="loading" class="spinner">⏳</span>
      <slot>Button</slot>
    </button>
  `,
}

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'danger', 'success', 'ghost'],
    },
    size: {
      control: 'select',
      options: ['small', 'medium', 'large'],
    },
    disabled: {
      control: 'boolean',
    },
    loading: {
      control: 'boolean',
    },
  },
  parameters: {
    // Chromatic configuration for this component
    chromatic: {
      viewports: [375, 768, 1440], // Test on mobile, tablet, desktop
      delay: 300, // Wait 300ms before snapshot
    },
  },
}

export default meta
type Story = StoryObj<typeof Button>

// Primary button
export const Primary: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Primary Button</Button>',
  }),
}

// Secondary button
export const Secondary: Story = {
  args: {
    variant: 'secondary',
    size: 'medium',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Secondary Button</Button>',
  }),
}

// Danger button
export const Danger: Story = {
  args: {
    variant: 'danger',
    size: 'medium',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Delete</Button>',
  }),
}

// Disabled state
export const Disabled: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    disabled: true,
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Disabled Button</Button>',
  }),
}

// Loading state
export const Loading: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
    loading: true,
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Loading...</Button>',
  }),
  parameters: {
    chromatic: {
      // Disable snapshot for loading state as it has animation
      disableSnapshot: false,
      // Pause animation at specific point
      pauseAnimationAtEnd: true,
    },
  },
}

// All sizes comparison
export const AllSizes: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div style="display: flex; gap: 1rem; align-items: center;">
        <Button size="small">Small</Button>
        <Button size="medium">Medium</Button>
        <Button size="large">Large</Button>
      </div>
    `,
  }),
}

// All variants comparison
export const AllVariants: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="danger">Danger</Button>
        <Button variant="success">Success</Button>
        <Button variant="ghost">Ghost</Button>
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      // Force snapshot even if CSS hasn't changed
      forcedReRender: true,
    },
  },
}

// Dark mode
export const DarkMode: Story = {
  args: {
    variant: 'primary',
    size: 'medium',
  },
  render: (args) => ({
    components: { Button },
    setup() {
      return { args }
    },
    template: '<Button v-bind="args">Dark Mode Button</Button>',
  }),
  parameters: {
    backgrounds: { default: 'dark' },
  },
}

// Responsive test
export const Responsive: Story = {
  render: () => ({
    components: { Button },
    template: `
      <div style="width: 100%; display: flex; gap: 1rem; flex-wrap: wrap;">
        <Button style="flex: 1; min-width: 120px;">Responsive</Button>
        <Button style="flex: 1; min-width: 120px;">Button</Button>
        <Button style="flex: 1; min-width: 120px;">Layout</Button>
      </div>
    `,
  }),
  parameters: {
    chromatic: {
      // Test on all defined viewports
      viewports: [375, 768, 1024, 1440],
    },
  },
}
