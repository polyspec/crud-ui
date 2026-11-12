import YAML from 'yaml';
import { compileForm, connectForm, connectOutline, createForm } from '@polyspec/crudui-generator-core';
import { renderData, renderForm, renderOutline } from '@polyspec/crudui-generator-html';
import '../../legacy/packages/generator/ts/styles/crudui.css';
import specText from './spec.yml?raw';
import data from './data.json';

const template = compileForm(YAML.parse(specText));
const form = createForm(template, data, { idPrefix: 'structure', language: 'ko' });
const formElement = document.getElementById('form');
const outlineElement = document.getElementById('outline');
const dataElement = document.getElementById('data');

formElement.innerHTML = renderForm(form);
const connection = connectForm(formElement, form);
connectOutline(outlineElement, form, formElement);

function render() {
  formElement.innerHTML = renderForm(form);
  connection.sync();
  outlineElement.innerHTML = renderOutline(form);
  dataElement.innerHTML = renderData(form);
}

form.subscribe(render);
render();
