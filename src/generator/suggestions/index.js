import { _ } from 'azk';
import { UIProxy } from 'azk/cli/ui';

export class Suggestion extends UIProxy {
  constructor(...args) {
    super(...args);

    // Initial Azkfile.js suggestion
    this.__suggestion = {
      __type  : 'example',
      name    : 'example',
      depends : [],
      shell   : '/bin/bash',
      image   : { docker: '[repository]:[tag]' },
      workdir : '/azk/#{app.dir}',
      wait    : 20,
      balancer: true,
      // command : '# command to run app',
      mounts  : {
        '/azk/#{app.dir}': {type: 'path', value: '.'},
      },
      envs_comment: [
        'Make sure that the PORT value is the same as the one',
        'in ports/http below, and that it\'s also the same',
        'if you\'re setting it in a .env file'
      ],
      envs: {
        EXAMPLE: 'value'
      }
    };
  }

  get suggestion() {
    return this.__suggestion;
  }

  set suggestion(value) {
    this.__suggestion = value;
  }

  extend(...args) {
    return require('azk/utils')._.extend({}, ...args);
  }

  suggest() {
    return this.suggestion;
  }

  hasEvidence(evidences, criteria) {
    var evidence = _.find(evidences, criteria);
    return !_.isEmpty(evidence);
  }
}
