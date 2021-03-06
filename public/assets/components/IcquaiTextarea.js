/* -*- indent-tabs-mode: nil; tab-width: 2; -*- */
/* vim: set ts=2 sw=2 et ai : */
/**
  Icquai: WebRTC peer-to-peer ephemeral chat in text and voice calls.
  Copyright (C) 2022. metastable-void and Menhera.org developers.

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published
  by the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
  @file
*/

const cloneEvent = (ev) => new ev.constructor(ev.type, ev);

export class IcquaiTextarea extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        #textarea {
          display: block;
          width: 100%;
          border: none;
          resize: none;
          padding: .25rem;
          outline: none !important;
          font: inherit;
          color: inherit;
          overflow: hidden;
          background-color: transparent;
          box-sizing: border-box;
        }
      </style>
      <textarea id="textarea" placeholder="Input text here"></textarea>
    `;
    const textarea = this.shadowRoot.querySelector('#textarea');
    //textarea.style.height = textarea.scrollHeight + 'px';
    textarea.addEventListener('input', (ev) => {
      textarea.style.height = 0;
      textarea.style.height = textarea.scrollHeight + 'px';
      //this.dispatchEvent(cloneEvent(ev));
    });
    textarea.addEventListener('keydown', (ev) => {
      //this.dispatchEvent(cloneEvent(ev));
    });
    textarea.addEventListener('keyup', (ev) => {
      //this.dispatchEvent(cloneEvent(ev));
    });
    textarea.addEventListener('click', (ev) => {
      if (textarea.readOnly) {
        textarea.focus();
        textarea.select();
      }
    });
  }

  static observedAttributes = ["value", "readonly"];

  connectedCallback() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    textarea.style.height = 0;
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  attributeChangedCallback(name, oldValue, newValue) {
    switch (name) {
      case 'value': {
        this.value = newValue;
        break;
      }
      case 'readonly': {
        if (newValue !== null && newValue !== undefined) {
          this.readOnly = true;
        }
        break;
      }
    }
  }

  get readOnly() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    return textarea.readOnly;
  }

  set readOnly(value) {
    const textarea = this.shadowRoot.querySelector('#textarea');
    textarea.readOnly = !!value;
  }

  get value() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    return textarea.value;
  }

  set value(value) {
    const textarea = this.shadowRoot.querySelector('#textarea');
    if (textarea.value != value) {
      textarea.value = value;
      textarea.style.height = 0;
      textarea.style.height = textarea.scrollHeight + 'px';
    }
  }

  get caretOffset() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    const activeElement = document.activeElement;
    //console.log('Active element:', activeElement);
    if (activeElement != this) {
      return -1;
    }
    if (textarea.selectionDirection == 'forward') {
      return textarea.selectionEnd;
    } else {
      return textarea.selectionStart;
    }
    /*
    const selection = document.getSelection();
    return selection.focusOffset;
    */
  }
}

customElements.define('icquai-textarea', IcquaiTextarea);
