package com.ridefreedom.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayDeque;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Ponte verso Garmin (o qualsiasi ciclocomputer/orologio): il telefono si presenta come sensore
 * Bluetooth standard con
 *  - Cycling Power Service (0x1818): potenza + giri della pedivella (cadenza) + giri della ruota
 *  - Cycling Speed and Cadence (0x1816): velocità e cadenza
 * L'app web invia i valori con update(); qui si calcolano i contatori cumulativi richiesti dai
 * protocolli e si notificano i dispositivi collegati una volta al secondo.
 */
@CapacitorPlugin(
    name = "GarminBridge",
    permissions = {
        @Permission(alias = "ble", strings = { Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class GarminBridgePlugin extends Plugin {
    private static UUID u16(int v) { return UUID.fromString(String.format("0000%04x-0000-1000-8000-00805f9b34fb", v)); }

    private static final UUID CPS = u16(0x1818), CP_MEAS = u16(0x2A63), CP_FEAT = u16(0x2A65), SENSOR_LOC = u16(0x2A5D);
    private static final UUID CSC = u16(0x1816), CSC_MEAS = u16(0x2A5B), CSC_FEAT = u16(0x2A5C);
    private static final UUID CCCD = u16(0x2902);
    private static final double WHEEL_M = 2.105;

    private BluetoothManager manager;
    private BluetoothGattServer server;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattCharacteristic cpMeas, cscMeas;
    private final Set<BluetoothDevice> connected = Collections.synchronizedSet(new HashSet<>());
    private final Set<String> cpSubs = Collections.synchronizedSet(new HashSet<>());
    private final Set<String> cscSubs = Collections.synchronizedSet(new HashSet<>());
    private final ArrayDeque<BluetoothGattService> pendingServices = new ArrayDeque<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running = false, advertising = false;
    private String deviceName = "RideFreedom";
    private static final String PREFS = "garmin_bridge"; private static final String KEY_ORIG = "original_bt_name";

    // valori correnti e contatori
    private volatile int power = 0;
    private volatile double cadence = 0, speedKmh = 0;
    private double crankAcc = 0, wheelAcc = 0;
    private int crankRevs = 0, crankTime1024 = 0;
    private long wheelRevs = 0; private int wheelTime2048 = 0, wheelTime1024 = 0;
    private long lastTick = 0;

    @PluginMethod
    public void start(PluginCall call) {
        deviceName = call.getString("name", "RideFreedom");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("ble") != PermissionState.GRANTED) {
            requestPermissionForAlias("ble", call, "permsCallback");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void permsCallback(PluginCall call) {
        if (getPermissionState("ble") == PermissionState.GRANTED) doStart(call);
        else call.reject("Permesso Bluetooth negato");
    }

    @SuppressLint("MissingPermission")
    private void doStart(PluginCall call) {
        if (running) { call.resolve(status()); return; }
        manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager == null ? null : manager.getAdapter();
        if (adapter == null || !adapter.isEnabled()) { call.reject("Bluetooth spento"); return; }
        advertiser = adapter.getBluetoothLeAdvertiser();
        if (advertiser == null) { call.reject("Questo telefono non può fare da sensore Bluetooth (advertising non supportato)"); return; }
        try {
            server = manager.openGattServer(getContext(), gattCallback);
        } catch (SecurityException e) { call.reject("Permesso Bluetooth mancante"); return; }
        if (server == null) { call.reject("Impossibile avviare il server Bluetooth"); return; }

        // Cycling Power
        BluetoothGattService cps = new BluetoothGattService(CPS, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        cpMeas = new BluetoothGattCharacteristic(CP_MEAS, BluetoothGattCharacteristic.PROPERTY_NOTIFY, 0);
        cpMeas.addDescriptor(new BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        cps.addCharacteristic(cpMeas);
        cps.addCharacteristic(new BluetoothGattCharacteristic(CP_FEAT, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));
        cps.addCharacteristic(new BluetoothGattCharacteristic(SENSOR_LOC, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));
        // Speed & Cadence
        BluetoothGattService csc = new BluetoothGattService(CSC, BluetoothGattService.SERVICE_TYPE_PRIMARY);
        cscMeas = new BluetoothGattCharacteristic(CSC_MEAS, BluetoothGattCharacteristic.PROPERTY_NOTIFY, 0);
        cscMeas.addDescriptor(new BluetoothGattDescriptor(CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
        csc.addCharacteristic(cscMeas);
        csc.addCharacteristic(new BluetoothGattCharacteristic(CSC_FEAT, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));
        csc.addCharacteristic(new BluetoothGattCharacteristic(SENSOR_LOC, BluetoothGattCharacteristic.PROPERTY_READ, BluetoothGattCharacteristic.PERMISSION_READ));

        // i servizi vanno aggiunti uno alla volta (onServiceAdded)
        pendingServices.clear();
        pendingServices.add(cps); pendingServices.add(csc);
        server.addService(pendingServices.poll());

        running = true;
        lastTick = System.currentTimeMillis();
        handler.post(ticker);
        call.resolve(status());
    }

    // Il nome nel pacchetto di advertising è il nome Bluetooth del telefono: lo cambiamo solo
    // mentre il ponte è attivo e salviamo l'originale per ripristinarlo (anche dopo una chiusura brusca).
    @SuppressLint("MissingPermission")
    private void renameAdapter() {
        try {
            BluetoothAdapter a = manager.getAdapter();
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String current = a.getName();
            if (!sp.contains(KEY_ORIG) && current != null && !current.equals(deviceName)) sp.edit().putString(KEY_ORIG, current).apply();
            a.setName(deviceName);
        } catch (SecurityException ignored) { }
    }

    @SuppressLint("MissingPermission")
    private void restoreAdapterName() {
        try {
            SharedPreferences sp = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String orig = sp.getString(KEY_ORIG, null);
            if (orig == null) return;
            BluetoothManager m = manager != null ? manager : (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
            if (m != null && m.getAdapter() != null && m.getAdapter().setName(orig)) sp.edit().remove(KEY_ORIG).apply();
        } catch (SecurityException ignored) { }
    }

    @Override
    public void load() {
        // se l'app era stata chiusa con il ponte acceso, rimette il nome originale del telefono
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("ble") == PermissionState.GRANTED) restoreAdapterName();
    }

    @SuppressLint("MissingPermission")
    private void startAdvertising() {
        if (advertiser == null || advertising) return;
        renameAdapter();
        // il cambio di nome richiede un attimo: si parte dopo mezzo secondo
        handler.postDelayed(this::doAdvertise, 600);
    }

    @SuppressLint("MissingPermission")
    private void doAdvertise() {
        if (!running || advertising) return;
        AdvertiseSettings settings = new AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true).build();
        // nome nel pacchetto principale (il Garmin non legge la risposta alla scansione)
        AdvertiseData data = new AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(new ParcelUuid(CPS)).build();
        AdvertiseData scan = new AdvertiseData.Builder()
            .addServiceUuid(new ParcelUuid(CSC)).build();
        try { advertiser.startAdvertising(settings, data, scan, advCallback); } catch (SecurityException e) { emit("error", "Permesso advertising mancante"); }
    }

    private final AdvertiseCallback advCallback = new AdvertiseCallback() {
        @Override public void onStartSuccess(AdvertiseSettings s) { advertising = true; emitStatus(); }
        @Override public void onStartFailure(int code) { advertising = false; emit("error", "Advertising non avviato (codice " + code + ")"); }
    };

    @PluginMethod
    public void update(PluginCall call) {
        Double p = call.getDouble("power"); Double c = call.getDouble("cadence"); Double s = call.getDouble("speedKmh");
        if (p != null) power = (int) Math.max(0, Math.min(3000, Math.round(p)));
        if (c != null) cadence = Math.max(0, Math.min(250, c));
        if (s != null) speedKmh = Math.max(0, Math.min(120, s));
        call.resolve();
    }

    @SuppressLint("MissingPermission")
    @PluginMethod
    public void stop(PluginCall call) {
        stopAll();
        call.resolve(status());
    }

    @PluginMethod
    public void getStatus(PluginCall call) { call.resolve(status()); }

    @SuppressLint("MissingPermission")
    private void stopAll() {
        running = false;
        handler.removeCallbacks(ticker);
        try { if (advertiser != null && advertising) advertiser.stopAdvertising(advCallback); } catch (SecurityException ignored) { }
        advertising = false;
        try { if (server != null) server.close(); } catch (SecurityException ignored) { }
        server = null; connected.clear(); cpSubs.clear(); cscSubs.clear();
        restoreAdapterName();
        emitStatus();
    }

    @Override
    protected void handleOnDestroy() { stopAll(); }

    // una volta al secondo: aggiorna i contatori e notifica
    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            if (!running) return;
            long now = System.currentTimeMillis();
            double dt = Math.min(2.0, (now - lastTick) / 1000.0);
            lastTick = now;
            // pedivella: tempo dell'ultimo giro completo in 1/1024 s
            if (cadence > 1) {
                double before = crankAcc; crankAcc += cadence / 60.0 * dt;
                int full = (int) Math.floor(crankAcc) - (int) Math.floor(before);
                if (full > 0) {
                    crankRevs = (crankRevs + full) & 0xFFFF;
                    double frac = (crankAcc - Math.floor(crankAcc)) / (cadence / 60.0); // secondi trascorsi dall'ultimo giro
                    long evt = now - (long) (frac * 1000);
                    crankTime1024 = (int) ((evt * 1024L / 1000L) & 0xFFFF);
                }
            }
            double mps = speedKmh / 3.6;
            if (mps > 0.1) {
                double before = wheelAcc; wheelAcc += mps / WHEEL_M * dt;
                int full = (int) Math.floor(wheelAcc) - (int) Math.floor(before);
                if (full > 0) {
                    wheelRevs = (wheelRevs + full) & 0xFFFFFFFFL;
                    double frac = (wheelAcc - Math.floor(wheelAcc)) / (mps / WHEEL_M);
                    long evt = now - (long) (frac * 1000);
                    wheelTime2048 = (int) ((evt * 2048L / 1000L) & 0xFFFF);
                    wheelTime1024 = (int) ((evt * 1024L / 1000L) & 0xFFFF);
                }
            }
            notifySubscribers(cpMeas, cpSubs, cpPacket());
            notifySubscribers(cscMeas, cscSubs, cscPacket());
            handler.postDelayed(this, 1000);
        }
    };

    // Cycling Power Measurement: flags(16) | potenza(sint16) | ruota uint32 + uint16 (1/2048 s) | pedivella uint16 + uint16 (1/1024 s)
    private byte[] cpPacket() {
        int flags = 0x10 | 0x20;
        byte[] b = new byte[14];
        put16(b, 0, flags); put16(b, 2, power);
        put32(b, 4, wheelRevs); put16(b, 8, wheelTime2048);
        put16(b, 10, crankRevs); put16(b, 12, crankTime1024);
        return b;
    }

    // CSC Measurement: flags(8) | ruota uint32 + uint16 (1/1024 s) | pedivella uint16 + uint16 (1/1024 s)
    private byte[] cscPacket() {
        byte[] b = new byte[11];
        b[0] = 0x03;
        put32(b, 1, wheelRevs); put16(b, 5, wheelTime1024);
        put16(b, 7, crankRevs); put16(b, 9, crankTime1024);
        return b;
    }

    private static void put16(byte[] b, int o, int v) { b[o] = (byte) (v & 0xFF); b[o + 1] = (byte) ((v >> 8) & 0xFF); }
    private static void put32(byte[] b, int o, long v) { for (int i = 0; i < 4; i++) b[o + i] = (byte) ((v >> (8 * i)) & 0xFF); }

    @SuppressLint("MissingPermission")
    @SuppressWarnings("deprecation")
    private void notifySubscribers(BluetoothGattCharacteristic ch, Set<String> subs, byte[] value) {
        if (server == null || ch == null) return;
        synchronized (connected) {
            for (BluetoothDevice d : connected) {
                if (!subs.contains(d.getAddress())) continue;
                try {
                    if (Build.VERSION.SDK_INT >= 33) server.notifyCharacteristicChanged(d, ch, false, value);
                    else { ch.setValue(value); server.notifyCharacteristicChanged(d, ch, false); }
                } catch (SecurityException ignored) { }
            }
        }
    }

    private final BluetoothGattServerCallback gattCallback = new BluetoothGattServerCallback() {
        @Override public void onServiceAdded(int status, BluetoothGattService service) {
            BluetoothGattService next = pendingServices.poll();
            if (next != null && server != null) {
                try { server.addService(next); } catch (SecurityException ignored) { }
            } else startAdvertising();
        }

        @SuppressLint("MissingPermission")
        @Override public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                connected.add(device);
                // accorgimento noto: "accettare" la connessione evita che Android la chiuda subito
                try { if (server != null) server.connect(device, false); } catch (SecurityException ignored) { }
            } else { connected.remove(device); cpSubs.remove(device.getAddress()); cscSubs.remove(device.getAddress()); }
            emit("log", (newState == BluetoothProfile.STATE_CONNECTED ? "connesso: " : "disconnesso: ") + label(device) + " (stato " + status + ")");
            emitStatus();
        }

        @Override public void onMtuChanged(BluetoothDevice device, int mtu) { emit("log", "MTU " + mtu + " con " + label(device)); }

        @SuppressLint("MissingPermission")
        @Override public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic ch) {
            byte[] v;
            UUID id = ch.getUuid();
            if (id.equals(CP_FEAT)) { v = new byte[4]; put32(v, 0, 0x0C); }          // giri ruota + pedivella
            else if (id.equals(CSC_FEAT)) { v = new byte[2]; put16(v, 0, 0x03); }    // ruota + pedivella
            else if (id.equals(SENSOR_LOC)) v = new byte[] { 13 };                   // mozzo posteriore (rullo)
            else v = new byte[0];
            emit("log", "lettura " + shortId(id) + " da " + label(device));
            try { server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, v); } catch (SecurityException ignored) { }
        }

        @SuppressLint("MissingPermission")
        @Override public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor d, boolean prepared, boolean needResp, int offset, byte[] value) {
            boolean on = value != null && value.length > 0 && (value[0] & 0x01) != 0;
            UUID ch = d.getCharacteristic().getUuid();
            Set<String> subs = ch.equals(CP_MEAS) ? cpSubs : cscSubs;
            if (on) subs.add(device.getAddress()); else subs.remove(device.getAddress());
            emit("log", (on ? "iscritto a " : "disiscritto da ") + shortId(ch) + ": " + label(device));
            if (needResp) try { server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null); } catch (SecurityException ignored) { }
            emitStatus();
        }

        @SuppressLint("MissingPermission")
        @Override public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattDescriptor d) {
            UUID ch = d.getCharacteristic().getUuid();
            boolean on = (ch.equals(CP_MEAS) ? cpSubs : cscSubs).contains(device.getAddress());
            try { server.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, on ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE : BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE); } catch (SecurityException ignored) { }
        }
    };

    @SuppressLint("MissingPermission")
    private JSObject status() {
        JSObject o = new JSObject();
        o.put("running", running);
        o.put("advertising", advertising);
        o.put("connected", connected.size());
        o.put("subscribed", cpSubs.size() + cscSubs.size());
        StringBuilder names = new StringBuilder();
        synchronized (connected) {
            for (BluetoothDevice d : connected) {
                String n = null;
                try { n = d.getName(); } catch (SecurityException ignored) { }
                if (names.length() > 0) names.append(", ");
                names.append(n != null ? n : d.getAddress());
            }
        }
        o.put("devices", names.toString());
        // chi usa davvero il sensore: si è iscritto ai dati di potenza o velocità/cadenza
        StringBuilder users = new StringBuilder(); int nUsers = 0;
        synchronized (connected) {
            for (BluetoothDevice d : connected) {
                if (!cpSubs.contains(d.getAddress()) && !cscSubs.contains(d.getAddress())) continue;
                String n = null;
                try { n = d.getName(); } catch (SecurityException ignored) { }
                if (users.length() > 0) users.append(", ");
                users.append(n != null ? n : d.getAddress()); nUsers++;
            }
        }
        o.put("users", users.toString());
        o.put("usersCount", nUsers);
        return o;
    }

    @SuppressLint("MissingPermission")
    private static String label(BluetoothDevice d) {
        String n = null;
        try { n = d.getName(); } catch (SecurityException ignored) { }
        return (n != null ? n + " " : "") + d.getAddress();
    }
    private static String shortId(UUID u) { return "0x" + u.toString().substring(4, 8); }

    private void emitStatus() { handler.post(() -> notifyListeners("status", status())); }
    private void emit(String type, String msg) { JSObject o = new JSObject(); o.put("message", msg); handler.post(() -> notifyListeners(type, o)); }
}
