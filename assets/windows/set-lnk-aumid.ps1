# Sets System.AppUserModel.ID on a .lnk shortcut (required for Windows toast registration).
param(
  [Parameter(Mandatory = $true)][string]$ShortcutPath,
  [string]$TargetPath,
  [string]$WorkingDirectory,
  [string]$AppUserModelId,
  [string]$Description
)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class FlexHubsPropertyStore
{
    [DllImport("Propsys.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    public static extern int PSGetPropertyKeyFromName(
        string pszName,
        out PROPERTYKEY pkey);

    [DllImport("Shlwapi.dll", CharSet = CharSet.Unicode, PreserveSig = true)]
    public static extern int SHGetPropertyStoreFromParsingName(
        string pszPath,
        IntPtr pbc,
        GETPROPERTYSTOREFLAGS flags,
        ref Guid riid,
        out IPropertyStore ppv);

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY
    {
        public Guid fmtid;
        public uint pid;
    }

    [Flags]
    public enum GETPROPERTYSTOREFLAGS
    {
        GPS_DEFAULT = 0,
        GPS_HANDLERPROPERTIESONLY = 0x1,
        GPS_READWRITE = 0x2,
        GPS_TEMPORARY = 0x4,
        GPS_FASTPROPERTIESONLY = 0x8,
        GPS_OPENSLOWITEM = 0x10,
        GPS_DELAYCREATION = 0x20,
        GPS_BESTEFFORT = 0x40,
        GPS_NO_OPLOCK = 0x80,
        GPS_PREFERQUERYPROPERTYCACHE = 0x100,
        GPS_EXTRINSICPROPERTIES = 0x200,
        GPS_EXTRINSICPROPERTIESONLY = 0x400,
        GPS_VOLATILEPROPERTIES = 0x800,
        GPS_VOLATILEPROPERTIESONLY = 0x1000,
        GPS_MASK_VALID = 0x1fff
    }

    [ComImport, Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore
    {
        int GetCount(out uint cProps);
        int GetAt(uint iProp, out PROPERTYKEY pkey);
        int GetValue(ref PROPERTYKEY key, out PropVariant pv);
        int SetValue(ref PROPERTYKEY key, ref PropVariant pv);
        int Commit();
    }

    [StructLayout(LayoutKind.Explicit)]
    public struct PropVariant
    {
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr pointerValue;
    }

    public const ushort VT_LPWSTR = 31;

    public static void SetAppUserModelId(string shortcutPath, string appId)
    {
        Guid iid = new Guid("886d8eeb-8cf2-4446-8d02-cdba1dbdcf99");
        IPropertyStore store;
        int hr = SHGetPropertyStoreFromParsingName(shortcutPath, IntPtr.Zero, GETPROPERTYSTOREFLAGS.GPS_READWRITE, ref iid, out store);
        if (hr != 0)
        {
            throw new InvalidOperationException("SHGetPropertyStoreFromParsingName failed: 0x" + hr.ToString("X8"));
        }

        PROPERTYKEY key;
        hr = PSGetPropertyKeyFromName("System.AppUserModel.ID", out key);
        if (hr != 0)
        {
            throw new InvalidOperationException("PSGetPropertyKeyFromName failed: 0x" + hr.ToString("X8"));
        }

        PropVariant pv = new PropVariant { vt = VT_LPWSTR, pointerValue = Marshal.StringToCoTaskMemUni(appId) };
        hr = store.SetValue(ref key, ref pv);
        if (hr != 0)
        {
            Marshal.FreeCoTaskMem(pv.pointerValue);
            throw new InvalidOperationException("IPropertyStore.SetValue failed: 0x" + hr.ToString("X8"));
        }

        hr = store.Commit();
        Marshal.FreeCoTaskMem(pv.pointerValue);
        if (hr != 0)
        {
            throw new InvalidOperationException("IPropertyStore.Commit failed: 0x" + hr.ToString("X8"));
        }
    }
}
"@ -ErrorAction Stop

$shell = New-Object -ComObject WScript.Shell

if ($TargetPath) {
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  if ($WorkingDirectory) {
    $shortcut.WorkingDirectory = $WorkingDirectory
  }
  if ($Description) {
    $shortcut.Description = $Description
  }
  $shortcut.Save()
} elseif (-not (Test-Path -LiteralPath $ShortcutPath)) {
  throw "Shortcut does not exist: $ShortcutPath"
}

if ($AppUserModelId) {
  [FlexHubsPropertyStore]::SetAppUserModelId($ShortcutPath, $AppUserModelId)
}