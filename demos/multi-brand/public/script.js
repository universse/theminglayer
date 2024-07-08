if (!CSS.supports('selector(:has(> *))')) {
  ;[...document.querySelectorAll('input[type="radio"]')].forEach((radio) => {
    if (radio.checked) {
      document.documentElement.setAttribute(`data-${radio.name}`, radio.value)
    }

    radio.addEventListener('change', (e) => {
      document.documentElement.setAttribute(
        `data-${e.target.name}`,
        e.target.value
      )
    })
  })
}
