import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';

/* npm-package */
import nock from 'nock';
import axios from 'axios';
/* без axiosHttpAdapter не работают хуки codeclimate для сбора coverage */
/* вернул значение для коректной работы сервиса */
import axiosHttpAdapter from 'axios/lib/adapters/http';

/* file loader */
import loader from '../src/index';

/* settings */
axios.defaults.adapter = axiosHttpAdapter;

/* variables */
const origin = 'https://ru.hexlet.io';
const pathname = '/courses';
const url = `${origin}${pathname}`;
const expectedHTML = 'ru-hexlet-io-courses.html';
const resourceFiles = 'ru-hexlet-io-courses_files';
let tempDir = '';

/* resources-data */
const resources = [
  {
    path: '/assets/application.css',
    name: 'ru-hexlet-io-assets-application.css',
  },
  {
    path: '/assets/professions/nodejs.png',
    name: 'ru-hexlet-io-assets-professions-nodejs.png',
  },
  {
    path: '/packs/js/runtime.js',
    name: 'ru-hexlet-io-packs-js-runtime.js',
  },
];

/* utils */
const getFixture = (filename) => path.join(__dirname, '..', '__fixtures__', filename);
const readFile = (filePath) => fs.readFile(filePath, 'utf-8');
const readFixture = (filename) => fs.readFile(getFixture(filename), 'utf-8');
const loadMockHTTPRequest = async () => {
  const indexFile = await readFixture('index.html');
  const scope = nock(origin).get(pathname).times(2).reply(200, indexFile);

  // eslint-disable-next-line no-restricted-syntax
  for await (const resource of resources) {
    const data = await readFixture(resource.name);
    scope.get(resource.path).reply(200, data);
  }

  return scope;
};

describe('page-loader', () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(async () => {
    nock.cleanAll();
    nock.enableNetConnect();
  });

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'page-loader-'));
  });

  describe('page loaded and saved with resources', () => {
    test('resource index.html', async () => {
      const scope = await loadMockHTTPRequest();
      await loader(url, tempDir);
      const actualHtml = await readFile(`${tempDir}/${expectedHTML}`);
      const expectedHtml = await readFixture(expectedHTML);
      expect(actualHtml).toBe(expectedHtml);
      scope.isDone();
    });

    test.each(resources.map(({ name }) => name))('resource loaded %s', async (name) => {
      const scope = await loadMockHTTPRequest();
      await loader(url, tempDir);
      const result = await readFile(`${tempDir}/${resourceFiles}/${name}`);
      const expected = await readFixture(name);
      expect(result).toBe(expected);
      scope.isDone();
    });
  });

  describe('error rejects', () => {
    test('throw error if empty arguments', async () => {
      await expect(loader()).rejects.toThrow('URL is empty');
    });

    test('throw error if page not exist', async () => {
      const scope = nock(origin).get(pathname).reply(500);
      await expect(loader(url, tempDir)).rejects.toThrow(Error);
      scope.isDone();
    });

    test('throw error if output dit not exist', async () => {
      await expect(loader(url, 'notExistedDir')).rejects.toThrowError(/notExistedDir/);
    });
  });
});
