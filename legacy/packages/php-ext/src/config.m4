PHP_ARG_ENABLE([polyspec-crudui], [whether to enable polyspec_crudui],
  [AS_HELP_STRING([--enable-polyspec-crudui], [Enable the polyspec_crudui native CRUDUI generation and validation])], [yes])

if test "$PHP_POLYSPEC_CRUDUI" != "no"; then
  AS_CASE([$host_os], [darwin*], [
    AC_ARG_VAR([MACOSX_DEPLOYMENT_TARGET], [Minimum macOS version for the extension])
    AS_IF([test -z "$MACOSX_DEPLOYMENT_TARGET"], [
      AC_COMPUTE_INT([crudui_macos_version],
        [__ENVIRONMENT_MAC_OS_X_VERSION_MIN_REQUIRED__], [],
        [AC_MSG_ERROR([Cannot determine the compiler's macOS deployment target; set MACOSX_DEPLOYMENT_TARGET])])
      AS_IF([test "$crudui_macos_version" -ge 100000], [
        MACOSX_DEPLOYMENT_TARGET="$((crudui_macos_version / 10000)).$((crudui_macos_version / 100 % 100)).$((crudui_macos_version % 100))"
      ], [
        MACOSX_DEPLOYMENT_TARGET="$((crudui_macos_version / 100)).$((crudui_macos_version / 10 % 10)).$((crudui_macos_version % 10))"
      ])
    ])
    AC_MSG_NOTICE([macOS deployment target: $MACOSX_DEPLOYMENT_TARGET])
    dnl A loadable bundle does not use the dynamic-library single-module flag.
    LT_MULTI_MODULE=yes
    PHP_ADD_LIBRARY([iconv])
    PHP_ADD_FRAMEWORK([CoreFoundation])
  ])
  PHP_ADD_LIBRARY([m])
  PHP_ADD_LIBRARY([pthread])
  dnl The version of the extension is the version of its package: composer.json lies beside src/, in the package and in the build of kit.
  PHP_POLYSPEC_CRUDUI_VERSION=`sed -n 's/.*"version": *"\([[^"]]*\)".*/\1/p' "$srcdir/../composer.json"`
  AC_DEFINE_UNQUOTED([PHP_POLYSPEC_CRUDUI_VERSION], ["$PHP_POLYSPEC_CRUDUI_VERSION"], [The version of the package])
  PHP_NEW_EXTENSION([polyspec_crudui], [crudui.c values.c errors.c text.c value.c value_path.c engine_error.c compose.c declaration.c display_declaration.c forbidden_scan.c template.c expression.c runtime.c date.c design.c widget.c messages.c interface_messages.c binding.c html.c render.c list.c whitespace.c canonical.c rule_length.c rule_in.c rule_condition_tree.c choice_list.c group_source.c references.c number_text.c rule_number.c unicode_data.c pattern_set.c pattern.c pattern_match.c rule_parameters.c validation.c key.c form.c outline.c view.c history.c actions.c], [$ext_shared])
fi
