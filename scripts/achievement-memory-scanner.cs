using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

internal static class AchievementMemoryScanner
{
    private const uint ProcessVmRead = 0x0010;
    private const uint ProcessQueryInformation = 0x0400;
    private const uint MemCommit = 0x1000;
    private const uint PageGuard = 0x100;
    private const uint PageNoAccess = 0x01;
    private const int ChunkSize = 4 * 1024 * 1024;

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryBasicInformation
    {
        public IntPtr BaseAddress;
        public IntPtr AllocationBase;
        public uint AllocationProtect;
        public UIntPtr RegionSize;
        public uint State;
        public uint Protect;
        public uint Type;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool ReadProcessMemory(
        IntPtr process,
        IntPtr baseAddress,
        [Out] byte[] buffer,
        UIntPtr size,
        out UIntPtr bytesRead);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern UIntPtr VirtualQueryEx(
        IntPtr process,
        IntPtr address,
        out MemoryBasicInformation information,
        UIntPtr informationLength);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static IEnumerable<int> FindAll(byte[] buffer, int count, byte[] pattern)
    {
        for (var index = 0; index <= count - pattern.Length; index++)
        {
            var matched = true;
            for (var offset = 0; offset < pattern.Length; offset++)
            {
                if (buffer[index + offset] == pattern[offset]) continue;
                matched = false;
                break;
            }
            if (matched) yield return index;
        }
    }

    private static string Hex(byte[] buffer, int start, int length)
    {
        var builder = new StringBuilder(length * 2);
        for (var index = start; index < start + length; index++) builder.Append(buffer[index].ToString("x2"));
        return builder.ToString();
    }

    private static void ScanPattern(
        byte[] buffer,
        int count,
        byte[] pattern,
        string encoding,
        ulong chunkAddress,
        ulong regionBase,
        uint regionType,
        HashSet<string> emitted)
    {
        foreach (var index in FindAll(buffer, count, pattern))
        {
            var address = chunkAddress + (ulong)index;
            var key = encoding + ":" + address.ToString("x");
            if (!emitted.Add(key)) continue;
            var contextStart = Math.Max(0, index - 64);
            var contextLength = Math.Min(count - contextStart, pattern.Length + 128);
            Console.WriteLine(
                "HIT\t{0}\t0x{1:x}\t0x{2:x}\t0x{3:x}\t{4}",
                encoding,
                address,
                regionBase,
                regionType,
                Hex(buffer, contextStart, contextLength));
        }
    }

    private static int Main(string[] args)
    {
        if (args.Length < 2)
        {
            Console.Error.WriteLine("Usage: achievement-memory-scanner <process-id> <achievement-id>");
            return 2;
        }

        int processId;
        if (!int.TryParse(args[0], NumberStyles.None, CultureInfo.InvariantCulture, out processId))
        {
            Console.Error.WriteLine("The process ID must be numeric.");
            return 2;
        }

        var process = OpenProcess(ProcessQueryInformation | ProcessVmRead, false, processId);
        if (process == IntPtr.Zero)
        {
            Console.Error.WriteLine("OpenProcess failed with Windows error " + Marshal.GetLastWin32Error() + ".");
            return 1;
        }

        if (args[1] == "--dump")
        {
            if (args.Length != 5)
            {
                Console.Error.WriteLine("Usage: achievement-memory-scanner <process-id> --dump <hex-address> <length> <output-file>");
                CloseHandle(process);
                return 2;
            }
            ulong dumpAddress;
            int dumpLength;
            if (!ulong.TryParse(args[2].Replace("0x", ""), NumberStyles.HexNumber, CultureInfo.InvariantCulture, out dumpAddress)
                || !int.TryParse(args[3], NumberStyles.None, CultureInfo.InvariantCulture, out dumpLength)
                || dumpLength <= 0)
            {
                Console.Error.WriteLine("Invalid dump address or length.");
                CloseHandle(process);
                return 2;
            }
            try
            {
                var dump = new byte[dumpLength];
                var totalRead = 0;
                for (var offset = 0; offset < dumpLength; offset += 4096)
                {
                    var pageLength = Math.Min(4096, dumpLength - offset);
                    var page = new byte[pageLength];
                    UIntPtr pageBytesRead;
                    ReadProcessMemory(
                        process,
                        new IntPtr(unchecked((long)(dumpAddress + (ulong)offset))),
                        page,
                        (UIntPtr)pageLength,
                        out pageBytesRead);
                    var actualPageLength = checked((int)pageBytesRead.ToUInt64());
                    if (actualPageLength <= 0) continue;
                    Buffer.BlockCopy(page, 0, dump, offset, actualPageLength);
                    totalRead += actualPageLength;
                }
                if (totalRead == 0)
                {
                    Console.Error.WriteLine("ReadProcessMemory could not read any page in the requested range.");
                    return 1;
                }
                File.WriteAllBytes(args[4], dump);
                Console.WriteLine("DUMP\t0x{0:x}\t{1}/{2}\t{3}", dumpAddress, totalRead, dumpLength, args[4]);
                return 0;
            }
            finally
            {
                CloseHandle(process);
            }
        }

        var smallPrivateOnly = args.Length > 2 && args[2] == "--small-private";
        var rawHex = args[1].StartsWith("hex:", StringComparison.OrdinalIgnoreCase);
        byte[] asciiPattern;
        byte[] unicodePattern;
        if (rawHex)
        {
            var hexPattern = args[1].Substring(4);
            if (hexPattern.Length == 0 || hexPattern.Length % 2 != 0)
            {
                Console.Error.WriteLine("A hex pattern must contain an even, non-zero number of digits.");
                CloseHandle(process);
                return 2;
            }
            asciiPattern = new byte[hexPattern.Length / 2];
            for (var index = 0; index < asciiPattern.Length; index++)
                asciiPattern[index] = byte.Parse(hexPattern.Substring(index * 2, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            unicodePattern = new byte[0];
        }
        else
        {
            asciiPattern = Encoding.ASCII.GetBytes(args[1]);
            unicodePattern = Encoding.Unicode.GetBytes(args[1]);
        }
        var emitted = new HashSet<string>();
        ulong address = 0;
        var informationSize = (UIntPtr)Marshal.SizeOf(typeof(MemoryBasicInformation));

        try
        {
            while (address < 0x00007fffffffffffUL)
            {
                MemoryBasicInformation information;
                if (VirtualQueryEx(process, new IntPtr(unchecked((long)address)), out information, informationSize) == UIntPtr.Zero) break;
                var regionBase = unchecked((ulong)information.BaseAddress.ToInt64());
                var regionSize = information.RegionSize.ToUInt64();
                if (regionSize == 0) break;

                var readable = information.State == MemCommit
                    && (information.Protect & PageGuard) == 0
                    && (information.Protect & PageNoAccess) == 0
                    && (!smallPrivateOnly || (information.Type == 0x20000 && regionSize <= 2 * 1024 * 1024));
                if (readable)
                {
                    ulong offset = 0;
            var overlap = Math.Max(asciiPattern.Length, unicodePattern.Length) - 1;
                    while (offset < regionSize)
                    {
                        var requested = (int)Math.Min((ulong)ChunkSize, regionSize - offset);
                        var buffer = new byte[requested];
                        UIntPtr bytesRead;
                        if (ReadProcessMemory(
                            process,
                            new IntPtr(unchecked((long)(regionBase + offset))),
                            buffer,
                            (UIntPtr)requested,
                            out bytesRead))
                        {
                            var count = checked((int)bytesRead.ToUInt64());
                            ScanPattern(buffer, count, asciiPattern, rawHex ? "hex" : "ascii", regionBase + offset, regionBase, information.Type, emitted);
                            if (unicodePattern.Length > 0)
                                ScanPattern(buffer, count, unicodePattern, "utf16", regionBase + offset, regionBase, information.Type, emitted);
                        }
                        if ((ulong)requested >= regionSize - offset) break;
                        offset += (ulong)Math.Max(1, requested - overlap);
                    }
                }
                var nextAddress = regionBase + regionSize;
                if (nextAddress <= address) break;
                address = nextAddress;
            }
        }
        finally
        {
            CloseHandle(process);
        }

        Console.WriteLine("DONE\t{0}", emitted.Count);
        return 0;
    }
}
