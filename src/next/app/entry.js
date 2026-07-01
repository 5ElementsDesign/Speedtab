const bootstrapPromise = import('./bootstrap.js')

bootstrapPromise
  .then(({renderNextRoot}) => renderNextRoot())
  .catch((error) => {
    console.error('Failed to initialize Speedtab Next', error)
  })

export {bootstrapPromise}
