import { config, path, fsAsync, _, utils } from 'azk';
import h from 'spec/spec_helper';
import { Generator } from 'azk/generator';
import { Manifest } from 'azk/manifest';

describe('Azk generator tool index:', function() {
  var outputs = [];
  var UI = h.mockUI(beforeEach, outputs);
  var generator = new Generator(UI);

  describe('run in a directory', function() {
    var dir;

    var default_data;
    before(() => {
      return h.tmp_dir().then((tmp) => {
        dir = tmp;
      });
    });

    beforeEach(function () {
      default_data = {
        systems: {
          front: {
            depends: ['db'],
            workdir: '/azk/#{manifest.dir}',
            image: { provider: 'docker', repository: 'base', tag: '0.1' },
            scalable: true,
            http: true,
            mounts: {
              '/azk/root': '/',
              '/azk/#{manifest.dir}': { type: 'path', value: '.' },
              '/azk/data': { type: 'persistent', value: 'data' },
            },
            command: 'bundle exec rackup config.ru',
            envs: { RACK_ENV: 'dev' },
          },
          db: {
            image: { docker: 'base' },
            export_envs: { DB_URL: export_db }
          }
        },
        defaultSystem: 'front',
        bins: [
          { name: 'console', command: ['bundler', 'exec'] }
        ]
      };
    });

    // Generates manifest file
    var generate_manifest = (dir, data) => {
      var file = path.join(dir, config('manifest'));
      return generator.render(data, file).then(function() {
        var manifest = new Manifest(dir);
        return manifest;
      });
    };

    var export_db = '#{envs.USER}:#{envs.PASSWORD}@#{net.host}:#{net.port.3666}';

    it('should generate with a valid format', function() {
      var extra = _.merge({}, default_data, {
        systems: {
          front: { envs: { 'F-O_O': 'BAR'}, scalable: { default: 3 }}
        }
      });

      return generate_manifest(dir, extra).then(function(manifest) {
        return fsAsync.readFile(manifest.file).then(function (data) {
          h.expect(data.toString()).to.match(/^\s{2}db: {$/m);
          h.expect(data.toString()).to.match(/^\s{6}RACK_ENV: "dev",$/m);
          h.expect(data.toString()).to.match(/^\s{6}'F-O_O': "BAR",$/m);
        });
      });

    });

    it('should generete a valid manifest file', function() {
      return generate_manifest(dir, default_data).then(function(manifest) {
        var system   = manifest.systemDefault;
        var name     = path.basename(dir);

        h.expect(system).to.have.deep.property('name', 'front');
        h.expect(system).to.have.deep.property('image.name', 'base:0.1');
        h.expect(system).to.have.deep.property('depends').and.to.eql(['db']);
        h.expect(system).to.have.deep.property('options.workdir', '/azk/' + name);
        h.expect(system).to.have.deep.property('options.scalable').and.ok;
        h.expect(system).to.have.deep.property('options.command')
          .and.to.eql('bundle exec rackup config.ru');
      });
    });

    it('should generate a mounts options', function() {
      return generate_manifest(dir, default_data).then(function(manifest) {
        var system   = manifest.systemDefault;
        var name     = path.basename(dir);

        var persist_base = config('paths:persistent_folders');
        persist_base = path.join(persist_base, manifest.namespace);

        var mounts = system.mounts;
        h.expect(system).to.have.property('mounts');

        if (config('agent:requires_vm')) {
          h.expect(mounts).to.have.property('/azk/root', config('agent:vm:mount_point') + '/');
        } else {
          h.expect(mounts).to.have.property('/azk/root', '/');
        }

        h.expect(mounts).to.have.property('/azk/' + name, utils.docker.resolvePath(manifest.manifestPath));
        h.expect(mounts).to.have.property('/azk/data', path.join(persist_base, 'data'));
      });
    });

    it('should generate export envs', function() {
      return generate_manifest(dir, default_data).then(function(manifest) {
        var system   = manifest.system('db');
        h.expect(system).to.have.deep.property('options.export_envs')
          .and.to.eql({
            DB_URL: '#{envs.USER}:#{envs.PASSWORD}@#{net.host}:#{net.port.3666}'
          });
      });
    });

    it('should support instances in scalable', function() {
      var data = _.merge({}, default_data, { systems: {
        front: {
          scalable: { default: 5 }
        }
      }});
      return generate_manifest(dir, data).then(function(manifest) {
        var system   = manifest.systemDefault;

        h.expect(system).to.have.deep.property('options.scalable')
          .and.eql({ default: 5});
      });
    });

    describe('with http options', function() {
      it('should generate a simple default host name', function() {
        return generate_manifest(dir, default_data).then(function(manifest) {
          var system    = manifest.systemDefault;
          var re_domain = RegExp(h.escapeRegExp(`${system.name}.${config('agent:balancer:host')}`));

          h.expect(system).to.have.deep.property('hosts').and.length(1);
          h.expect(system).to.have.deep.property('hosts[0]').and.match(re_domain);
        });
      });

      it('should generate a multiple hosts', function() {
        var data = _.clone(default_data);
        data.systems.front.http = { domains: [
          '#{system.name}.#{azk.default_domain}',
          'custom.#{azk.default_domain}',
        ] };

        return generate_manifest(dir, data).then(function(manifest) {
          var system     = manifest.systemDefault;
          var re_default = RegExp(h.escapeRegExp(`${system.name}.${config('agent:balancer:host')}`));
          var re_custom  = RegExp(h.escapeRegExp(`custom.${config('agent:balancer:host')}`));

          h.expect(system).to.have.deep.property('hosts').and.length(2);
          h.expect(system).to.have.deep.property('hosts[0]').and.match(re_default);
          h.expect(system).to.have.deep.property('hosts[1]').and.match(re_custom);
        });
      });
    });
  });
});
