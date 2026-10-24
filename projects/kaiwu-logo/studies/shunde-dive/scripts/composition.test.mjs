import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Exercise CLI routing with temporary fixtures, without invoking FFmpeg or models.
const check = `
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
from unittest import mock

spec = importlib.util.spec_from_file_location("composer", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    module.PROJECT = root / "project"
    module.OUTPUT = module.PROJECT / "output"
    module.COMPARISON = module.OUTPUT / "comparison-v4"
    module.COMPARISON.mkdir(parents=True)
    scripts = module.PROJECT / "scripts"
    scripts.mkdir()
    (scripts / "comparison-variants.json").write_text(json.dumps([
        {"name": "03-reconet", "backgroundSource": "output/comparison-v4/03-reconet-background.mp4"}
    ]))
    for path in [
        module.OUTPUT / "badge-v3-alpha.mov",
        module.OUTPUT / "background-v3-clean.mp4",
        module.COMPARISON / "03-reconet-background.mp4",
    ]:
        path.touch()
    default = module.OUTPUT / "kaiwu-shunde-dive-2026-4s-v2-red-sem.mp4"
    explicit = root / "external-soundtrack.m4a"
    default.touch()
    explicit.touch()
    recolor = Path(sys.argv[1]).name == "recolor-reconet.py"
    target = module.COMPARISON / ("03b-reconet-color-final.mp4" if recolor else "03-reconet-final.mp4")
    for audio, options in [(default, []), (explicit, ["--soundtrack", str(explicit)])]:
        with mock.patch.object(sys, "argv", ["composer", *options]), \\
             mock.patch.object(module.subprocess, "run") as run, \\
             contextlib.redirect_stdout(io.StringIO()):
            module.main()
            assert run.call_count == 1
            command = run.call_args.args[0]
            assert command[command.index(str(audio)) - 1] == "-i"
            assert command[command.index("-c:a") + 1] == "copy"
            assert "-n" in command and str(target) in command
            if recolor:
                recipe = json.loads((module.COMPARISON / "03b-reconet-color.json").read_text())
                assert recipe["inputs"][-1] == (
                    str(audio.relative_to(module.PROJECT)) if audio.is_relative_to(module.PROJECT) else str(audio)
                )
            target.touch()
            try:
                module.main()
                raise AssertionError("Existing output must not be overwritten")
            except FileExistsError:
                assert run.call_count == 1
            target.unlink()
    with mock.patch.object(sys, "argv", ["composer", "--soundtrack", str(root / "missing.m4a")]), \\
         mock.patch.object(module.subprocess, "run") as run:
        try:
            module.main()
            raise AssertionError("Missing soundtrack must fail explicitly")
        except FileNotFoundError as error:
            assert "--soundtrack" in str(error)
            run.assert_not_called()
`;

for (const filename of ['compose-comparison.py', 'recolor-reconet.py']) {
  test(`${filename}: explicit/default audio, no overwrite, missing-input error`, () => {
    execFileSync('python', ['-B', '-c', check, fileURLToPath(new URL(filename, import.meta.url))],
      {encoding: 'utf8'});
  });
}
