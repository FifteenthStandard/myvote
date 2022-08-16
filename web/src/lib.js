export function sequence() {
  const funcs = [...arguments];
  return function (ev) {
    for (const func of funcs) {
      func(ev);
    }
  }
}

export function setStateHandler(setState) {
  return function (ev) {
    setState(ev.target.value);
  };
}

export function setStateFormHandler(setState) {
  return function (ev) {
    const data = new FormData(ev.target.form);
    setState([ ...data ]);
  }
}