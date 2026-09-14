import {describe, expect, it} from 'vitest'
import {syncNoteWidgets} from '../features/note-widgets/index.js'

describe('World Clock note widget', () => {
  it('renders digital time, date, and analog markup for each configured zone', () => {
    document.body.innerHTML = `
      <article data-floating-window>
        <section data-world-clock>
          <div data-clock-zone="Europe/Berlin"><h3 data-clock-zone></h3><span data-clock></span><time data-date data-date-format="{year}-{month}-{day}"></time></div>
          <div data-world-clock-items data-world-clock-default-timezone="Europe/Berlin">
            <div data-world-clock-item data-clock-zone="Europe/Berlin"><span data-clock></span></div>
            <div data-world-clock-item data-clock-zone="America/New_York"><span data-clock></span><span data-clock data-analog data-seconds></span></div>
          </div>
        </section>
      </article>
    `

    syncNoteWidgets(document)

    const zones = document.querySelectorAll('[data-world-clock] [data-clock-zone]')
    expect(zones[0].querySelector('[data-clock]')?.textContent).not.toBe('')
    expect(zones[0].querySelector('[data-date]')?.textContent).toMatch(/^\d{4}-\d{1,2}-\d{1,2}$/)
    expect(zones[0].querySelector('h3')?.textContent).toBe('Berlin')
    const items = document.querySelectorAll('[data-world-clock-item]')
    expect(items[0].dataset.deviatesFromDefault).toBe('0')
    expect(items[0].dataset.deviatesFromDefaultRange).toBe('0')
    expect(Number(items[1].dataset.deviatesFromDefault)).not.toBe(0)
    expect(items[1].dataset.deviatesFromDefaultRange).not.toBe('0')
    expect(items[1].querySelector('[data-clock]')?.textContent).not.toBe('')
    expect(items[1].querySelector('[data-clock] + [data-clock] svg')).not.toBeNull()
    expect(items[1].querySelectorAll('[data-clock] + [data-clock] svg line')).toHaveLength(15)
  })
})
