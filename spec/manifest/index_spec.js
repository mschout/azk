import { t, _, fs, config } from 'azk';
import { Manifest, file_name } from 'azk/manifest';
import { System } from 'azk/system';
import { ManifestError, ManifestRequiredError, SystemNotFoundError } from 'azk/utils/errors';
import h from 'spec/spec_helper';

var path = require('path');
var default_img = config('docker:image_default');

describe("Azk manifest class, main set", function() {
  describe("in a valid azk project folder", function() {
    var project, manifest;

    before(function() {
      return h.mockManifest({}).then((mf) => {
        manifest = mf;
        project  = mf.manifestPath;
      });
    });

    it("should find manifest in root project folder", function() {
      h.expect(manifest).to.have.property('file', path.join(project, file_name));
      h.expect(manifest).to.have.property('manifestPath', path.join(project));
      h.expect(manifest).to.have.property('manifestDirName', path.basename(project));
    });

    it("should find manifest in subfolder", function() {
      var manifest = new Manifest(path.join(project, "src"));
      h.expect(manifest).to.have.property('file', manifest.file);
    });

    it("should parse manifest file", function() {
      h.expect(manifest).to.have.property('systems')
        .and.have.property('example');
    });

    it("should calculate a namespace", function() {
      h.expect(manifest).to.have.property('namespace')
        .and.length(10);
    });

    it("should set a default system", function() {
      h.expect(manifest).to.have.property('systemDefault')
        .and.eql(manifest.system('api'));
    });

    it("should parse systems to System class", function() {
      h.expect(manifest.system('example')).to.instanceof(System);
    });

    it("should support meta data", function() {
      manifest.setMeta('anykey', 'anyvalue');
      h.expect(manifest.getMeta('anykey')).to.equal('anyvalue');
      return manifest.cleanMetaAsync().then(function() {
        return h.expect(manifest.getMeta('anykey')).to.empty;
      });
    });

    it("should raise an error if not found a required system", function() {
      var func = () => manifest.system("not_found_system", true);
      h.expect(func).to.throw(SystemNotFoundError, /not_found_system/);
    });

    describe("implement getSystemsByName", function() {
      it("should return all systems", function() {
        var systems = manifest.getSystemsByName();
        h.expect(systems).to.length(_.keys(manifest.systems).length);
        h.expect(systems).to.has.deep.property("[0]").to.equal(
          manifest.system("expand-test")
        );
        h.expect(systems).to.has.deep.property("[11]").to.equal(
          manifest.system("example")
        );
      });

      it("should raise error if get a not set system", function() {
        var func = () => manifest.getSystemsByName("example,not_found_system");
        h.expect(func).to.throw(SystemNotFoundError, /not_found_system/);
      });

      it("should return one system", function() {
        var systems = manifest.getSystemsByName("example");
        h.expect(systems).to.length(1);
        h.expect(systems[0]).to.instanceOf(System);
        h.expect(systems[0]).to.have.property("name", "example");
      });

      it("should return one or more systems", function() {
        var systems = manifest.getSystemsByName("example,db");
        h.expect(systems).to.length(2);
        h.expect(systems).to.have.deep.property("[0]").and.instanceOf(System);
        h.expect(systems).to.have.deep.property("[0].name", "db");
        h.expect(systems).to.have.deep.property("[1]").and.instanceOf(System);
        h.expect(systems).to.have.deep.property("[1].name", "example");
      });
    });

    describe("with a tree of the requireds systems", function() {
      it("should return a systems in required order", function() {
        var systems = [ "expand-test", "mount-test", "ports-disable", "ports-static", "ports-test",
                        "test-image-opts", "empty", "db", "api", "example-sync", "example-extends", "example"];

        h.expect(manifest.systemsInOrder()).to.eql(systems);
      });

      it("should return a systems in required order to a system", function() {
        h.expect(manifest.systemsInOrder("example")).to.eql(
          ["db", "api", "example"]
        );
        h.expect(manifest.systemsInOrder(["example", "api"])).to.eql(
          ["db", "api", "example"]
        );
        h.expect(manifest.systemsInOrder(["example", "empty"])).to.eql(
          ["db", "api", "example", "empty"]
        );
      });

      it("should raise if get order an unset system", function() {
        var func = () => manifest.systemsInOrder("not_found_system");
        h.expect(func).to.throw(SystemNotFoundError, /not_found_system/);
      });
    });
  });

  describe("in a directory", function() {
    var project;

    before(() => {
      return h.tmp_dir({ prefix: "azk-test-" }).then((dir) => project = dir);
    });

    it("should require a cwd in new manifest", function() {
      var func = () => new Manifest(null, true);
      h.expect(func).to.throw(Error, /require.*path/);
    });

    it("should raise an error if manifest is required", function() {
      var func = () => { new Manifest(project, true); };
      h.expect(func).to.throw(
        ManifestRequiredError, RegExp(h.escapeRegExp(project))
      );
    });

    it("should be make a fake manifest", function() {
      var manifest = Manifest.makeFake(project, default_img);
      var system   = manifest.systemDefault;
      h.expect(manifest).to.instanceof(Manifest);
      h.expect(manifest).to.have.property("cwd" , project);
      h.expect(manifest).to.have.property("file", path.join(project, config("manifest")));
      h.expect(system).to.have.property("name", "--tmp--");
      h.expect(system).to.have.deep.property("image.name", default_img);
    });

    it("should support meta data in fake manifest", function() {
      var manifest = Manifest.makeFake(project, default_img);
      manifest.setMeta('anykey', 'anyvalue');
      h.expect(manifest.getMeta('anykey')).to.equal('anyvalue');
    });
  });

  describe("in a not manifest with a valid syntax", function() {
    var project, file;

    before(() => {
      return h.tmp_dir({ prefix: "azk-test-" }).then((dir) => {
        file = path.join(dir, file_name);
        project = dir;
      });
    });

    var mock_manifest = (data) => {
      fs.writeFileSync(file, data);
      return () => new Manifest(project);
    };

    it("should raise a invalid system name", function() {
      var func = mock_manifest('system("system.1", { image: { docker: "foo" } });');
      var msgs = t("manifest.system_name_invalid", { system: "system.1" });
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise a sytax error", function() {
      var func = mock_manifest("var a; \n var = ;");
      h.expect(func).to.throw(ManifestError).and.match(/Unexpected token/);
    });

    it("should raise a if use balancer option", function() {
      var func = mock_manifest('system("system", { image: { docker: "foo" }, balancer: { key: "value" } });');
      var msgs = t("manifest.balancer_deprecated", { system: "system" });
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise a if use mounts_folders option", function() {
      var func = mock_manifest('system("system", { image: { docker: "foo" }, mount_folders: { key: "value" } });');
      var opts = { option: 'mount_folders', system: 'system', manifest: file };
      var msgs = h.escapeRegExp(t("manifest.mount_and_persistent_deprecated", opts));
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise a if use persistent_folders option", function() {
      var func = mock_manifest('system("system", { image: { docker: "foo" }, persistent_folders: { key: "value" } });');
      var opts = { option: 'persistent_folders', system: 'system', manifest: file };
      var msgs = h.escapeRegExp(t("manifest.mount_and_persistent_deprecated", opts));
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise error if an image has not been configured", function() {
      var func = mock_manifest('system("system1", { });');
      var msgs = t("manifest.image_required", { system: "system1" });
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise an exception if the dependency is circular systems", function() {
      var data = "";
      data += 'system("system1", { image: { docker: "foo" }, depends: ["system2"] });';
      data += 'system("system2", { image: { docker: "foo" }, depends: ["system1"] });';

      var func = mock_manifest(data);
      var msgs = t("manifest.circular_dependency", {system1: "system1", system2: "system2"});
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise an exception if the dependency it's not declared", function() {
      var data = "";
      data += 'system("system1", { image: { docker: "foo" }, depends: ["system2"] });';

      var func = mock_manifest(data);
      var msgs = t("manifest.depends_not_declared", {system: "system1", depend: "system2"});
      h.expect(func).to.throw(ManifestError).and.match(RegExp(msgs));
    });

    it("should raise invalid function error", function() {
      var func = mock_manifest("__not_exist()");
      h.expect(func).to.throw(ManifestError).and.match(
        /ReferenceError: __not_exist is not defined/
      );
    });

    it("should raise invalid default system", function() {
      var func = mock_manifest("setDefault('not_exist')");
      var msg  = t('manifest.invalid_default', { system: "not_exist" });
      h.expect(func).to.throw(ManifestError).and.match(
        RegExp(h.escapeRegExp(msg))
      );
    });
  });

  describe("extends from other system", function() {
    it("should inherit everything from mother system", function() {
      return h.mockManifest({ }).then((mf) => {
        var manifest = mf;
        var example_system         = manifest.system('example');
        var example_extends_system = manifest.system('example-extends');

        // all equal
        h.expect(example_extends_system.options.shell)    .to.be.deep.equal(example_system.options.shell);
        h.expect(example_extends_system.options.depends)  .to.be.deep.equal(example_system.options.depends);
        h.expect(example_extends_system.options.envs)     .to.be.deep.equal(example_system.options.envs);
        h.expect(example_extends_system.options.provision).to.be.deep.equal(example_system.options.provision);
        h.expect(example_extends_system.options.workdir)  .to.be.deep.equal(example_system.options.workdir);
        h.expect(example_extends_system.options.command)  .to.be.deep.equal(example_system.options.command);
        h.expect(example_extends_system.options.mounts)   .to.be.deep.equal(example_system.options.mounts);

        //divergent
        h.expect(example_system.options.scalable.default)        .to.be.equal(3);
        h.expect(example_extends_system.options.scalable.default).to.be.equal(1);

      });
    });

    it("should raise an exception when trying to extend from non existent system", function() {
      var data = {
        systems: {
          "example-extends-error": {
            extends: "example-NOT_EXISTS",
          }
        }
      };

      return h.mockManifest(data).catch(function(err) {
        var msg  = t('manifest.extends_system_invalid',
                    { system_source   : 'example-NOT_EXISTS',
                      system_to_extend: 'example-extends-error' });

        h.expect(err.err_message).to.equal(msg);
      });
    });

    describe('_system_validate', function () {
      var project, file;

      before(() => {
        return h.tmp_dir({ prefix: "azk-test-" }).then((dir) => {
          file = path.join(dir, file_name);
          project = dir;
        });
      });

      var mock_manifest = (data) => {
        fs.writeFileSync(file, data);
        return () => new Manifest(project);
      };

      it("should raise an exception when trying to extend from itself", function() {
        var func = mock_manifest('system("system1", { extends: "system1" });');
        var msg  = t('manifest.cannot_extends_itself', { system: "system1" });
        h.expect(func).to.throw(ManifestError).and.match(
          RegExp(h.escapeRegExp(msg))
        );
      });

    });

  });

});
