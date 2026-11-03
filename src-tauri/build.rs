fn main() {
    // tauri-build embeds the exe icon but only reruns when tauri.conf.json or
    // capabilities change, so a new icon would otherwise ship the old one.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    // build:local's version and commit, for the log's header (crash.rs).
    for var in [
        "VITE_BUILD_VERSION",
        "VITE_BUILD_COMMIT",
        "VITE_BUILD_MODIFIED",
    ] {
        println!("cargo:rerun-if-env-changed={var}");
    }
    // The exe names its .pdb without the folder it was built in (which names
    // the builder), PLAN 3V.8.
    if std::env::var("PROFILE").as_deref() == Ok("release") {
        println!("cargo:rustc-link-arg-bins=/PDBALTPATH:%_PDB%");
    }
    tauri_build::build()
}
