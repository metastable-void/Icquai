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


export class IcquaiTextarea extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});
    this.shadowRoot.innerHTML = `
      <style>
        #textarea {
          display: block;
          width: 100%;
          box-sizing: border-box;
          border: none;
          resize: none;
        }
      </style>
      <textarea id="textarea"></textarea>
    `;
    const textarea = this.shadowRoot.querySelector('#textarea');
    //textarea.style.height = textarea.scrollHeight + 'px';
    textarea.addEventListener('input', (ev) => {
      textarea.style.height = textarea.scrollHeight + 'px';
      this.dispatchEvent(new Event('input'));
    });
  }

  connectedCallback() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    textarea.style.height = textarea.scrollHeight + 'px';
  }

  get value() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    return textarea.value;
  }

  get caretOffset() {
    const textarea = this.shadowRoot.querySelector('#textarea');
    const activeElement = document.activeElement;
    if (activeElement != textarea) {
      return -1;
    }
    const selection = document.getSelection();
    return selection.focusOffset;
  }
}

customElements.define('icquai-textarea', IcquaiTextarea);
