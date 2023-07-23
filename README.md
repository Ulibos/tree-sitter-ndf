tree-sitter-ndf
=================

A  [`tree-sitter`][0]  grammar for Eugen Systems ndf files.  This project was primarily
intended for use with   [`ndf-parse`][1]  package for python but can be fleshed out for
actual use in editors if needed.

Building It Yourself
--------------------

This tool was created (and tested) under Windows 10 and all instructions assume Windows
OS. If, however, you're using different OS, you probably know what you're doing and can
adapt this for yourself.

You will need tools mentioned in [Getting Started][2]  part of the official tree-sitter
manual  (chapters `"Dependencies"`  and  `"Installation"`).  After installing them, you
need to checkout this repo,  `cd`  into it and call  `build.bat` script that is shipped
with this repo. It should generate a folder named `build` containing a parser dll.

Assumptions and Caveats
-----------------------

Since there is only a short manual on how to write an ndf code that barely covers the
topic, some assumptions worth keeping in mind were made. These assumptions are:

- Commas can be used very loosely in template parameters section (you can skip or stack
  multiple commas in a row with no params inbetween or even discard commas  completely)
  and relatively loosely in vector types and lists  (you can stack multiple commas, but
  you can't skip commas between list items). That is because of the following case (for
  lists):
  
  ```ndf
    //GameData\Gameplay\Skirmish\Strategies\GenericSkirmishStrategy.ndf:101
            ~/Airstrike_Offensive_AA,,  // note the double comma
  ```

  and because `member` and `param` share the same parser code (for params).

- `member` or `param` decladation can have a colon to indicate a type while not having
  an actual type declaration. That is because of the following case:
  
  ```ndf
    //GameData\UserInterface\Use\InGame\UISpecificShortcutsForSelectionView.ndf:13
        MagnifiableWidthHeightTexture : = [30.0, 30.0],  // note the absent type decl
  ```

- `unnamed` is not restricted to a single occurrence in file. It is doable but IMO this
  is more of a case for a language server rather than this parser.

- One can declare a member or a  mathematic expression  at the root level and it  won't
  be considered a syntax error (although this would be an invalid code for an ndf file)
  because this tool is meant to allow to easily generate a single statement for further
  injection back into a model in the already mentioned [`ndf-parse`][1] tool.

About
-----

Created by Ulibos, 2023.

[0]: https://tree-sitter.github.io/tree-sitter/
[1]: https://github.com/Ulibos/ndf-parse
[2]: https://tree-sitter.github.io/tree-sitter/creating-parsers
